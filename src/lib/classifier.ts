import { PDFDocument } from "pdf-lib";

import type { LLMProvider } from "./providers/types";

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
  | "t1_main"
  | "t4"
  | "t4a"
  | "t3"
  | "t5"
  | "provincial_main"
  | "provincial_schedule"
  | "t2125"
  | "rrsp_receipt"
  | "worksheet"
  | "supporting_doc"
  | "cover_letter"
  | "direct_deposit"
  | "carryover_summary"
  | "efiling_auth"
  | "crypto_detail"
  | "other";

export interface PageClassification {
  pageNumber: number;
  formType: FormType;
}

const CLASSIFICATION_PROMPT = `Classify each page of this tax return PDF. For each page, identify the form type.

Classification categories:
- 1040_main: Form 1040 pages 1-2 (the main federal return with income, deductions, tax)
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
- state_main: State tax return main pages (Form 540 for CA, IT-201 for NY, etc.)
- state_schedule: State return supporting schedules
- worksheet: Calculation worksheets (tax computation, AMT, etc.)
- supporting_doc: W-2, 1099, or other source document copies
- cover_letter: Preparer transmittal letters, engagement letters, "Dear Client" letters
- direct_deposit: Direct deposit/debit reports showing bank routing and account numbers
- carryover_summary: Tax return carryovers to next year, loss carryforward summaries
- efiling_auth: E-file authorization forms (Form 8879, TR-579-IT, e-file jurat/disclosure)
- crypto_detail: Cryptocurrency transaction details, lot-by-lot disposal reports
- t1_main: T1 General Income Tax and Benefit Return (pages 1–4, the main Canadian federal return with Social Insurance Number, CRA header, income lines 10100–26000, federal tax line 40400)
- t4: T4 Statement of Remuneration Paid (employer name, Box 14 employment income, Box 22 income tax deducted)
- t4a: T4A Statement of Pension, Retirement, Annuity, and Other Income
- t3: T3 Statement of Trust Income Allocations and Designations
- t5: T5 Statement of Investment Income
- provincial_main: Provincial tax forms (Form ON428, BC428, AB428, QC TP-1, etc.) — contains province name + "Tax and Credits"
- provincial_schedule: Provincial supporting schedules (ON-BEN, BC479, etc.)
- t2125: Statement of Business or Professional Activities (self-employment income)
- rrsp_receipt: RRSP contribution receipts
- other: Any other pages not fitting above categories

IMPORTANT: Look for these clues to identify preparer documents vs actual tax forms:
- Cover letters often start with "Dear [Name]" and mention "RKO Tax", "H&R Block", etc.
- Direct deposit pages show routing numbers, account numbers in a table format
- Carryover summaries have "Carryovers to [Year]" in the title
- E-file auth pages mention "penalties of perjury", "ERO Declaration", "Taxpayer PIN"
- The actual Form 1040 has "U.S. Individual Income Tax Return" and numbered lines

Respond with a JSON array where each element has:
- "page": page number (1-indexed)
- "type": one of the classification categories above

Example response format:
[
  {"page": 1, "type": "cover_letter"},
  {"page": 2, "type": "carryover_summary"},
  {"page": 3, "type": "1040_main"}
]

Classify ALL pages in the document.`;

export async function classifyPages(
  pdfBase64: string,
  provider: LLMProvider,
): Promise<PageClassification[]> {
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // For small PDFs, skip classification entirely and process all pages
  if (totalPages <= 20) {
    return Array.from({ length: totalPages }, (_, i) => ({
      pageNumber: i + 1,
      formType: "other" as FormType,
    }));
  }

  return provider.classifyPages(pdfBase64, CLASSIFICATION_PROMPT);
}
