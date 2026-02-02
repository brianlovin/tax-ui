import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PDFDocument } from "pdf-lib";

import { classifyPages } from "./classifier";
import { EXTRACTION_PROMPT } from "./prompt";
import { type LabeledAmount, type TaxReturn, TaxReturnSchema } from "./schema";
import { selectPages } from "./selector";

// Max pages per extraction chunk (after smart selection)
const MAX_PAGES = 40;

// Threshold for using smart classification (skip for small PDFs)
const CLASSIFICATION_THRESHOLD = 20;

async function extractPages(pdfBase64: string, pageNumbers: number[]): Promise<string> {
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // Filter out invalid page numbers (1-indexed input)
  const validPageNumbers = pageNumbers.filter((p) => p >= 1 && p <= totalPages);

  if (validPageNumbers.length === 0) {
    throw new Error(
      `No valid pages to extract. Requested: ${pageNumbers.join(", ")}, PDF has ${totalPages} pages`,
    );
  }

  const newDoc = await PDFDocument.create();
  // pageNumbers are 1-indexed, copyPages needs 0-indexed
  const pages = await newDoc.copyPages(
    pdfDoc,
    validPageNumbers.map((p) => p - 1),
  );
  pages.forEach((page) => newDoc.addPage(page));

  const newBytes = await newDoc.save();
  return Buffer.from(newBytes).toString("base64");
}

async function splitPdf(pdfBase64: string): Promise<string[]> {
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  if (totalPages <= MAX_PAGES) {
    return [pdfBase64];
  }

  const chunks: string[] = [];
  for (let start = 0; start < totalPages; start += MAX_PAGES) {
    const end = Math.min(start + MAX_PAGES, totalPages);
    const chunkDoc = await PDFDocument.create();
    const pages = await chunkDoc.copyPages(
      pdfDoc,
      Array.from({ length: end - start }, (_, i) => start + i),
    );
    pages.forEach((page) => chunkDoc.addPage(page));
    const chunkBytes = await chunkDoc.save();
    chunks.push(Buffer.from(chunkBytes).toString("base64"));
  }

  return chunks;
}

async function parseChunk(pdfBase64: string, client: Anthropic): Promise<TaxReturn> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(TaxReturnSchema),
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return JSON.parse(textBlock.text);
}

function mergeLabeledAmounts(
  existing: LabeledAmount[],
  incoming: LabeledAmount[],
): LabeledAmount[] {
  const map = new Map<string, number>();

  for (const item of existing) {
    map.set(item.label, item.amount);
  }
  for (const item of incoming) {
    if (!map.has(item.label)) {
      map.set(item.label, item.amount);
    }
  }

  return Array.from(map.entries()).map(([label, amount]) => ({ label, amount }));
}

function mergeReturns(returns: TaxReturn[]): TaxReturn {
  const first = returns[0];
  if (!first) {
    throw new Error("No tax returns to merge");
  }

  if (returns.length === 1) {
    return first;
  }

  // Start with the first result as the base (usually has the main 1040 data)
  const base = first;

  for (let i = 1; i < returns.length; i++) {
    const chunk = returns[i]!;

    // Merge income items
    base.income.items = mergeLabeledAmounts(base.income.items, chunk.income.items);

    // Use the higher total income if found
    if (chunk.income.total > base.income.total) {
      base.income.total = chunk.income.total;
    }

    // Merge federal deductions, additional taxes, credits, payments
    base.federal.deductions = mergeLabeledAmounts(
      base.federal.deductions,
      chunk.federal.deductions,
    );
    base.federal.additionalTaxes = mergeLabeledAmounts(
      base.federal.additionalTaxes,
      chunk.federal.additionalTaxes,
    );
    base.federal.credits = mergeLabeledAmounts(base.federal.credits, chunk.federal.credits);
    base.federal.payments = mergeLabeledAmounts(base.federal.payments, chunk.federal.payments);

    // Merge state returns
    for (const chunkState of chunk.states) {
      const existingState = base.states.find((s) => s.name === chunkState.name);
      if (existingState) {
        existingState.deductions = mergeLabeledAmounts(
          existingState.deductions,
          chunkState.deductions,
        );
        existingState.adjustments = mergeLabeledAmounts(
          existingState.adjustments,
          chunkState.adjustments,
        );
        existingState.payments = mergeLabeledAmounts(existingState.payments, chunkState.payments);
      } else {
        base.states.push(chunkState);
      }
    }

    // Merge dependents
    const existingDependentNames = new Set(base.dependents.map((d) => d.name));
    for (const dep of chunk.dependents) {
      if (!existingDependentNames.has(dep.name)) {
        base.dependents.push(dep);
      }
    }

    // Use rates if base doesn't have them
    if (!base.rates && chunk.rates) {
      base.rates = chunk.rates;
    }
  }

  return base;
}

async function smartExtract(pdfBase64: string, client: Anthropic): Promise<TaxReturn> {
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // For small PDFs, process directly without classification
  if (totalPages <= CLASSIFICATION_THRESHOLD) {
    const chunks = await splitPdf(pdfBase64);
    if (chunks.length === 1) {
      return parseChunk(chunks[0]!, client);
    }
    const results: TaxReturn[] = [];
    for (const chunk of chunks) {
      results.push(await parseChunk(chunk, client));
    }
    return mergeReturns(results);
  }

  // Classify pages using Haiku
  let classifications;
  try {
    classifications = await classifyPages(pdfBase64, client);
  } catch (error) {
    // Fallback: process first 40 pages if classification fails
    console.error("Classification failed, using fallback:", error);
    const fallbackPages = Array.from({ length: Math.min(totalPages, MAX_PAGES) }, (_, i) => i + 1);
    const fallbackPdf = await extractPages(pdfBase64, fallbackPages);
    return parseChunk(fallbackPdf, client);
  }

  // Select important pages based on classification
  const selection = selectPages(classifications);
  const { selectedPages } = selection;

  // If no pages selected or selection too small, use fallback
  if (selectedPages.length === 0) {
    const fallbackPages = Array.from({ length: Math.min(totalPages, MAX_PAGES) }, (_, i) => i + 1);
    const fallbackPdf = await extractPages(pdfBase64, fallbackPages);
    return parseChunk(fallbackPdf, client);
  }

  // Extract only selected pages
  if (selectedPages.length <= MAX_PAGES) {
    const selectedPdf = await extractPages(pdfBase64, selectedPages);
    return parseChunk(selectedPdf, client);
  }

  // If still too many pages, chunk the selected pages
  const results: TaxReturn[] = [];
  for (let start = 0; start < selectedPages.length; start += MAX_PAGES) {
    const chunkPageNumbers = selectedPages.slice(start, start + MAX_PAGES);
    const chunkPdf = await extractPages(pdfBase64, chunkPageNumbers);
    results.push(await parseChunk(chunkPdf, client));
  }

  return mergeReturns(results);
}

export async function parseTaxReturn(pdfBase64: string, apiKey: string): Promise<TaxReturn> {
  const client = new Anthropic({ apiKey });
  return smartExtract(pdfBase64, client);
}

export async function extractYearFromPdf(
  pdfBase64: string,
  apiKey: string,
): Promise<number | null> {
  const client = new Anthropic({ apiKey });

  // Extract just the first page for fast year detection
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const firstPageDoc = await PDFDocument.create();
  const [firstPage] = await firstPageDoc.copyPages(pdfDoc, [0]);
  firstPageDoc.addPage(firstPage);
  const firstPageBase64 = Buffer.from(await firstPageDoc.save()).toString("base64");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: firstPageBase64,
              },
            },
            {
              type: "text",
              text: "What tax year is this document for? Respond with ONLY the 4-digit year (e.g., 2023). If you cannot determine the year, respond with 'UNKNOWN'.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return null;
    }

    const yearMatch = textBlock.text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return parseInt(yearMatch[0], 10);
    }
    return null;
  } catch (error) {
    console.error("Year extraction failed:", error);
    return null;
  }
}
