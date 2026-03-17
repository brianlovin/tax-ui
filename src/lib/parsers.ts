import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  type BankStatement,
  BankStatementSchema,
  type DocumentType,
  DocumentTypeSchema,
  type Payslip,
  PayslipSchema,
} from "./schema";

const FAST_MODEL = "claude-haiku-4-5-20251001";
const MAIN_MODEL = "claude-sonnet-4-5-20250929";

// ============================================
// DOCUMENT TYPE DETECTION
// ============================================

const DETECT_DOCUMENT_PROMPT = `Analyze this PDF and determine what type of Australian financial document it is.

Respond with ONLY ONE of these types:
- "tax-return" - Australian tax return (Notice of Assessment, tax return form)
- "payslip" - Australian payslip/pay statement from an employer
- "bank-statement" - Bank account statement showing transactions

Look for:
- Tax return: ATO logos, tax return labels (income, deductions, offsets), assessment notices
- Payslip: Employer name, pay period dates, gross/net pay, PAYG tax withheld, superannuation
- Bank statement: Bank logo/name, account number, transaction list with dates and amounts`;

export async function detectDocumentType(pdfBase64: string, apiKey: string): Promise<DocumentType> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 100,
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
            text: DETECT_DOCUMENT_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Failed to detect document type");
  }

  const text = textBlock.text.trim().toLowerCase();
  const parsed = DocumentTypeSchema.safeParse(text);
  if (!parsed.success) {
    // Try to extract from text
    if (text.includes("payslip") || text.includes("pay slip")) {
      return "payslip";
    }
    if (text.includes("bank") || text.includes("statement")) {
      return "bank-statement";
    }
    return "tax-return";
  }

  return parsed.data;
}

// ============================================
// PAYSLIP PARSER
// ============================================

const PAYSLIP_PROMPT = `Extract all information from this Australian payslip.

Key fields to extract:
1. Pay period: start date, end date, and pay date
2. Employer: name and ABN if present
3. Employee: name and employee ID if present
4. Earnings breakdown: description, hours (if shown), rate (if shown), and amount for each line
5. Deductions: description and amount for each (tax, super, etc.)
6. Gross earnings (total before deductions)
7. Total deductions
8. Net pay (take-home amount)
9. Superannuation: fund name, contributions (employer and employee if shown)
10. Year-to-date totals (if shown)

Important:
- amounts should be numbers without currency symbols
- dates should be in ISO format (YYYY-MM-DD)
- include ALL earnings and deduction line items
- if a field is not present, omit it rather than guessing`;

export async function parsePayslip(pdfBase64: string, apiKey: string): Promise<Payslip> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MAIN_MODEL,
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
            text: PAYSLIP_PROMPT,
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(PayslipSchema),
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Failed to parse payslip");
  }

  const parsed = PayslipSchema.safeParse(JSON.parse(textBlock.text));
  if (!parsed.success) {
    throw new Error(`Invalid payslip data: ${parsed.error.message}`);
  }

  return parsed.data;
}

// ============================================
// BANK STATEMENT PARSER
// ============================================

const BANK_STATEMENT_PROMPT = `Extract all information from this bank statement.

Key fields to extract:
1. Bank name (e.g., "ANZ", "Commonwealth Bank", "Up", "NAB")
2. Account name and account number (last 4 digits only for privacy)
3. Statement period: start date and end date
4. Opening balance
5. Closing balance
6. ALL transactions with:
   - Date (ISO format YYYY-MM-DD or the format shown)
   - Description/merchant name
   - Amount (negative for debits/money out, positive for credits/money in)
   - Running balance (if shown)
   - Type: "debit" or "credit"

7. Summary totals:
   - Total credits (money in)
   - Total debits (money out)

Important:
- Amounts should be numbers (negative for debits, positive for credits)
- Include ALL transactions visible
- If you can identify the expense category based on the description, include it (e.g., groceries, fuel, etc.)`;

export async function parseBankStatement(
  pdfBase64: string,
  apiKey: string,
): Promise<BankStatement> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MAIN_MODEL,
    max_tokens: 8192,
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
            text: BANK_STATEMENT_PROMPT,
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(BankStatementSchema),
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Failed to parse bank statement");
  }

  const parsed = BankStatementSchema.safeParse(JSON.parse(textBlock.text));
  if (!parsed.success) {
    throw new Error(`Invalid bank statement data: ${parsed.error.message}`);
  }

  return parsed.data;
}

// ============================================
// UNIFIED PARSE FUNCTION
// ============================================

export type ParsedDocument =
  | { type: "tax-return"; data: unknown }
  | { type: "payslip"; data: Payslip }
  | { type: "bank-statement"; data: BankStatement };

export async function parseDocument(
  pdfBase64: string,
  apiKey: string,
  documentType?: DocumentType,
): Promise<{ type: DocumentType; data: Payslip | BankStatement }> {
  // Detect document type if not provided
  const type = documentType || (await detectDocumentType(pdfBase64, apiKey));

  switch (type) {
    case "payslip":
      return {
        type: "payslip",
        data: await parsePayslip(pdfBase64, apiKey),
      };
    case "bank-statement":
      return {
        type: "bank-statement",
        data: await parseBankStatement(pdfBase64, apiKey),
      };
    default:
      throw new Error(`Unsupported document type: ${type}`);
  }
}
