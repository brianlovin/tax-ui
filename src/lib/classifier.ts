import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";

export type FormType =
  | "1040_main"
  | "schedule_1"
  | "schedule_2"
  | "schedule_3"
  | "schedule_a"
  | "schedule_b"
  | "schedule_c"
  | "schedule_d"
  | "schedule_e"
  | "k1_summary"
  | "k1_detail"
  | "state_main"
  | "state_schedule"
  | "worksheet"
  | "supporting_doc"
  | "other";

export interface PageClassification {
  pageNumber: number;
  formType: FormType;
}

const CLASSIFICATION_PROMPT = `Classify each page of this tax return PDF. For each page, identify the form type.

Classification categories:
- 1040_main: Form 1040 pages 1-2 (the main federal return)
- schedule_1: Schedule 1 - Additional Income and Adjustments
- schedule_2: Schedule 2 - Additional Taxes
- schedule_3: Schedule 3 - Additional Credits and Payments
- schedule_a: Schedule A - Itemized Deductions
- schedule_b: Schedule B - Interest and Dividends
- schedule_c: Schedule C - Business Income
- schedule_d: Schedule D - Capital Gains and Losses
- schedule_e: Schedule E - Supplemental Income (rentals, royalties, partnerships, S corps)
- k1_summary: Schedule K-1 summary/first page (contains income amounts)
- k1_detail: Schedule K-1 supporting pages, instructions, or continuation pages
- state_main: State tax return main pages (Form 540, IT-201, etc.)
- state_schedule: State return supporting schedules
- worksheet: Calculation worksheets (tax computation, AMT, etc.)
- supporting_doc: W-2, 1099, or other source document copies
- other: Cover pages, signature pages, preparer notes, engagement letters

Respond with a JSON array where each element has:
- "page": page number (1-indexed)
- "type": one of the classification categories above

Example response format:
[
  {"page": 1, "type": "1040_main"},
  {"page": 2, "type": "1040_main"},
  {"page": 3, "type": "schedule_1"}
]

Classify ALL pages in the document.`;

export async function classifyPages(
  pdfBase64: string,
  client: Anthropic,
): Promise<PageClassification[]> {
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // For small PDFs, skip classification
  if (totalPages <= 20) {
    return Array.from({ length: totalPages }, (_, i) => ({
      pageNumber: i + 1,
      formType: "other" as FormType,
    }));
  }

  // Use Haiku for fast, cheap classification
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
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
            text: CLASSIFICATION_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No classification response from Claude");
  }

  // Parse the JSON response
  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not parse classification response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Array<{
    page: number;
    type: string;
  }>;

  return parsed.map((item) => ({
    pageNumber: item.page,
    formType: item.type as FormType,
  }));
}
