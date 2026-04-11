import { PDFDocument } from "pdf-lib";

import { type AIConfig, generateObjectFromPDF, generateTextFromPDFFast } from "./ai";
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

async function parseChunk(pdfBase64: string, config: AIConfig): Promise<TaxReturn> {
  return generateObjectFromPDF(config, pdfBase64, EXTRACTION_PROMPT, TaxReturnSchema);
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

  // Start with the first result as the base
  const base = first;

  for (let i = 1; i < returns.length; i++) {
    const chunk = returns[i]!;

    // Merge income items
    base.income.items = mergeLabeledAmounts(base.income.items, chunk.income.items);

    // Use the higher total income if found
    if (chunk.income.total > base.income.total) {
      base.income.total = chunk.income.total;
    }

    // Merge deductions
    base.deductions.items = mergeLabeledAmounts(base.deductions.items, chunk.deductions.items);

    // Use the higher deduction total if found (more negative)
    if (chunk.deductions.total < base.deductions.total) {
      base.deductions.total = chunk.deductions.total;
    }

    // Merge tax offsets
    base.tax.offsets = mergeLabeledAmounts(base.tax.offsets, chunk.tax.offsets);

    // Merge PAYG withholding items
    base.paygWithholding.items = mergeLabeledAmounts(
      base.paygWithholding.items,
      chunk.paygWithholding.items,
    );

    // Use rates if base doesn't have them
    if (!base.rates && chunk.rates) {
      base.rates = chunk.rates;
    }

    // Use location if base doesn't have it
    if (!base.location.postcode && chunk.location.postcode) {
      base.location = chunk.location;
    }

    // Use spouse info if base doesn't have it
    if (!base.spouse && chunk.spouse) {
      base.spouse = chunk.spouse;
    }

    // Merge private health insurance info
    if (!base.privateHealthInsurance && chunk.privateHealthInsurance) {
      base.privateHealthInsurance = chunk.privateHealthInsurance;
    }
  }

  return base;
}

async function smartExtract(pdfBase64: string, config: AIConfig): Promise<TaxReturn> {
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // For small PDFs, process directly without classification
  if (totalPages <= CLASSIFICATION_THRESHOLD) {
    const chunks = await splitPdf(pdfBase64);
    if (chunks.length === 1) {
      return parseChunk(chunks[0]!, config);
    }
    const results: TaxReturn[] = [];
    for (const chunk of chunks) {
      results.push(await parseChunk(chunk, config));
    }
    return mergeReturns(results);
  }

  // Classify pages using Haiku
  let classifications;
  try {
    classifications = await classifyPages(pdfBase64, config);
  } catch (error) {
    // Fallback: process first 40 pages if classification fails
    console.error("Classification failed, using fallback:", error);
    const fallbackPages = Array.from({ length: Math.min(totalPages, MAX_PAGES) }, (_, i) => i + 1);
    const fallbackPdf = await extractPages(pdfBase64, fallbackPages);
    return parseChunk(fallbackPdf, config);
  }

  // Select important pages based on classification
  const selection = selectPages(classifications);
  const { selectedPages } = selection;

  // If no pages selected or selection too small, use fallback
  if (selectedPages.length === 0) {
    const fallbackPages = Array.from({ length: Math.min(totalPages, MAX_PAGES) }, (_, i) => i + 1);
    const fallbackPdf = await extractPages(pdfBase64, fallbackPages);
    return parseChunk(fallbackPdf, config);
  }

  // Extract only selected pages
  if (selectedPages.length <= MAX_PAGES) {
    const selectedPdf = await extractPages(pdfBase64, selectedPages);
    return parseChunk(selectedPdf, config);
  }

  // If still too many pages, chunk the selected pages
  const results: TaxReturn[] = [];
  for (let start = 0; start < selectedPages.length; start += MAX_PAGES) {
    const chunkPageNumbers = selectedPages.slice(start, start + MAX_PAGES);
    const chunkPdf = await extractPages(pdfBase64, chunkPageNumbers);
    results.push(await parseChunk(chunkPdf, config));
  }

  return mergeReturns(results);
}

export async function parseTaxReturn(
  pdfBase64: string,
  apiKey: string,
  provider: string = "vercel",
): Promise<TaxReturn> {
  const config: AIConfig = {
    provider: provider as AIConfig["provider"],
    apiKey,
  };
  return smartExtract(pdfBase64, config);
}

export async function extractYearFromPdf(
  pdfBase64: string,
  apiKey: string,
  provider: string = "vercel",
): Promise<number | null> {
  const config: AIConfig = {
    provider: provider as AIConfig["provider"],
    apiKey,
  };

  // Extract just the first page for fast year detection
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const firstPageDoc = await PDFDocument.create();
  const [firstPage] = await firstPageDoc.copyPages(pdfDoc, [0]);
  firstPageDoc.addPage(firstPage);
  const firstPageBase64 = Buffer.from(await firstPageDoc.save()).toString("base64");

  try {
    const response = await generateTextFromPDFFast(
      config,
      firstPageBase64,
      "What Australian financial year is this tax return for? Respond with ONLY the 4-digit ending year (e.g., 2023 for the 2022-23 financial year). If you cannot determine the year, respond with 'UNKNOWN'.",
    );

    const yearMatch = response.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return parseInt(yearMatch[0], 10);
    }
    return null;
  } catch (error) {
    console.error("Year extraction failed:", error);
    return null;
  }
}
