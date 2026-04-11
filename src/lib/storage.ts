import path from "path";

import {
  type BankStatement,
  type ExpenseEntry,
  type Payslip,
  type TaxReturn,
  TaxReturnSchema,
  type Transaction,
  type YearExpenses,
} from "./schema";

const DATA_DIR = process.env.TAX_UI_DATA_DIR || process.cwd();
const RETURNS_FILE = path.join(DATA_DIR, ".tax-returns.json");
const EXPENSES_FILE = path.join(DATA_DIR, ".expenses.json");
const PAYSLIPS_FILE = path.join(DATA_DIR, ".payslips.json");
const BANK_STATEMENTS_FILE = path.join(DATA_DIR, ".bank-statements.json");
const TRANSACTIONS_FILE = path.join(DATA_DIR, ".transactions.json");
const ENV_FILE = path.join(DATA_DIR, ".env");

// Backfill missing array fields for old stored data, then validate with Zod
function migrate(data: Record<number, unknown>): Record<number, TaxReturn> {
  const result: Record<number, TaxReturn> = {};
  for (const [year, raw] of Object.entries(data)) {
    const ret = raw as Record<string, unknown>;
    const fed = (ret.federal ?? {}) as Record<string, unknown>;
    const patched = {
      ...ret,
      dependents: ret.dependents ?? [],
      federal: {
        ...fed,
        deductions: fed.deductions ?? [],
        additionalTaxes: fed.additionalTaxes ?? [],
        credits: fed.credits ?? [],
        payments: fed.payments ?? [],
      },
      states: ((ret.states ?? []) as Record<string, unknown>[]).map((s) => ({
        ...s,
        deductions: s.deductions ?? [],
        adjustments: s.adjustments ?? [],
        payments: s.payments ?? [],
      })),
    };
    const parsed = TaxReturnSchema.safeParse(patched);
    if (parsed.success) {
      result[Number(year)] = parsed.data;
    } else {
      console.warn(`Skipping invalid stored return for year ${year}:`, parsed.error.issues);
    }
  }
  return result;
}

export async function getReturns(): Promise<Record<number, TaxReturn>> {
  const file = Bun.file(RETURNS_FILE);
  if (await file.exists()) {
    return migrate(await file.json());
  }
  return {};
}

export async function saveReturn(taxReturn: TaxReturn): Promise<void> {
  const returns = await getReturns();
  returns[taxReturn.year] = taxReturn;
  await Bun.write(RETURNS_FILE, JSON.stringify(returns, null, 2));
}

export async function deleteReturn(year: number): Promise<void> {
  const returns = await getReturns();
  delete returns[year];
  await Bun.write(RETURNS_FILE, JSON.stringify(returns, null, 2));
}

// ============================================
// EXPENSES
// ============================================

export async function getExpenses(): Promise<Record<number, YearExpenses>> {
  const file = Bun.file(EXPENSES_FILE);
  if (await file.exists()) {
    return await file.json();
  }
  return {};
}

export async function saveExpenseEntry(entry: ExpenseEntry): Promise<void> {
  const expenses = await getExpenses();

  if (!expenses[entry.year]) {
    expenses[entry.year] = {
      year: entry.year,
      entries: [],
    };
  }

  const yearExpenses = expenses[entry.year]!;
  const existingIndex = yearExpenses.entries.findIndex((e) => e.id === entry.id);
  if (existingIndex >= 0) {
    yearExpenses.entries[existingIndex] = entry;
  } else {
    yearExpenses.entries.push(entry);
  }

  await Bun.write(EXPENSES_FILE, JSON.stringify(expenses, null, 2));
}

export async function deleteExpenseEntry(year: number, entryId: string): Promise<void> {
  const expenses = await getExpenses();
  if (expenses[year]) {
    expenses[year].entries = expenses[year].entries.filter((e) => e.id !== entryId);
    await Bun.write(EXPENSES_FILE, JSON.stringify(expenses, null, 2));
  }
}

// ============================================
// PAYSLIPS
// ============================================

export async function getPayslips(): Promise<Payslip[]> {
  const file = Bun.file(PAYSLIPS_FILE);
  if (await file.exists()) {
    return await file.json();
  }
  return [];
}

export async function savePayslip(payslip: Payslip): Promise<void> {
  const payslips = await getPayslips();
  const existingIndex = payslips.findIndex((p) => p.id === payslip.id);
  if (existingIndex >= 0) {
    payslips[existingIndex] = payslip;
  } else {
    payslips.push(payslip);
  }
  await Bun.write(PAYSLIPS_FILE, JSON.stringify(payslips, null, 2));
}

export async function deletePayslip(id: string): Promise<void> {
  const payslips = await getPayslips();
  const filtered = payslips.filter((p) => p.id !== id);
  await Bun.write(PAYSLIPS_FILE, JSON.stringify(filtered, null, 2));
}

// ============================================
// BANK STATEMENTS
// ============================================

export async function getBankStatements(): Promise<BankStatement[]> {
  const file = Bun.file(BANK_STATEMENTS_FILE);
  if (await file.exists()) {
    return await file.json();
  }
  return [];
}

export async function saveBankStatement(statement: BankStatement): Promise<void> {
  const statements = await getBankStatements();
  const existingIndex = statements.findIndex((s) => s.id === statement.id);
  if (existingIndex >= 0) {
    statements[existingIndex] = statement;
  } else {
    statements.push(statement);
  }
  await Bun.write(BANK_STATEMENTS_FILE, JSON.stringify(statements, null, 2));
}

export async function deleteBankStatement(id: string): Promise<void> {
  const statements = await getBankStatements();
  const filtered = statements.filter((s) => s.id !== id);
  await Bun.write(BANK_STATEMENTS_FILE, JSON.stringify(filtered, null, 2));
}

// ============================================
// API KEY
// ============================================

export function getApiKey(): string | undefined {
  const provider = getStoredProvider();
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "google":
      return process.env.GOOGLE_API_KEY;
    case "vercel":
    case "gateway":
    case "anthropic":
    default:
      return process.env.AI_SDK_KEY;
  }
}

export function getApiKeys(): Record<string, string> {
  return {
    vercel: process.env.AI_SDK_KEY || "",
    anthropic: process.env.AI_SDK_KEY || "",
    openai: process.env.OPENAI_API_KEY || "",
    google: process.env.GOOGLE_API_KEY || "",
  };
}

export function getStoredProvider(): string {
  return process.env.AI_PROVIDER || "vercel";
}

export async function saveApiKey(key: string, provider: string = "vercel"): Promise<void> {
  const keyName =
    provider === "openai"
      ? "OPENAI_API_KEY"
      : provider === "google"
        ? "GOOGLE_API_KEY"
        : "AI_SDK_KEY";

  const file = Bun.file(ENV_FILE);
  let content = "";

  if (await file.exists()) {
    content = await file.text();
    const regex = new RegExp(`^${keyName}=.*$`, "gm");
    if (regex.test(content)) {
      content = content.replace(regex, `${keyName}=${key}`);
    } else {
      content = content.trim() + `\n${keyName}=${key}\n`;
    }
  } else {
    content = `${keyName}=${key}\n`;
  }

  await Bun.write(ENV_FILE, content);
  process.env[keyName] = key;
}

export async function saveProvider(provider: string): Promise<void> {
  const file = Bun.file(ENV_FILE);
  let content = "";

  if (await file.exists()) {
    content = await file.text();
    if (content.includes("AI_PROVIDER=")) {
      content = content.replace(/AI_PROVIDER=.*/g, `AI_PROVIDER=${provider}`);
    } else {
      content = content.trim() + `\nAI_PROVIDER=${provider}\n`;
    }
  } else {
    content = `AI_PROVIDER=${provider}\n`;
  }

  await Bun.write(ENV_FILE, content);
  process.env.AI_PROVIDER = provider;
}

export async function removeApiKey(): Promise<void> {
  const envFile = Bun.file(ENV_FILE);
  if (await envFile.exists()) {
    let content = await envFile.text();
    content = content.replace(/^AI_SDK_KEY=.*$/gm, "").trim();
    if (content) {
      await Bun.write(ENV_FILE, content + "\n");
    } else {
      const fs = await import("fs/promises");
      await fs.unlink(ENV_FILE);
    }
  }
  delete process.env.AI_SDK_KEY;
}

export async function clearAllData(): Promise<void> {
  // Clear tax returns
  const returnsFile = Bun.file(RETURNS_FILE);
  if (await returnsFile.exists()) {
    await Bun.write(RETURNS_FILE, "{}");
  }

  // Clear expenses
  const expensesFile = Bun.file(EXPENSES_FILE);
  if (await expensesFile.exists()) {
    await Bun.write(EXPENSES_FILE, "{}");
  }

  // Clear payslips
  const payslipsFile = Bun.file(PAYSLIPS_FILE);
  if (await payslipsFile.exists()) {
    await Bun.write(PAYSLIPS_FILE, "[]");
  }

  // Clear bank statements
  const statementsFile = Bun.file(BANK_STATEMENTS_FILE);
  if (await statementsFile.exists()) {
    await Bun.write(BANK_STATEMENTS_FILE, "[]");
  }

  // Clear API key from .env
  const envFile = Bun.file(ENV_FILE);
  if (await envFile.exists()) {
    let content = await envFile.text();
    content = content.replace(/^AI_SDK_KEY=.*$/gm, "").trim();
    if (content) {
      await Bun.write(ENV_FILE, content + "\n");
    } else {
      const fs = await import("fs/promises");
      await fs.unlink(ENV_FILE);
    }
  }
  delete process.env.AI_SDK_KEY;
}

// ============================================
// TRANSACTIONS
// ============================================

export async function getTransactions(): Promise<Transaction[]> {
  const file = Bun.file(TRANSACTIONS_FILE);
  if (await file.exists()) {
    return await file.json();
  }
  return [];
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const transactions = await getTransactions();
  const existingIndex = transactions.findIndex((t) => t.id === transaction.id);
  if (existingIndex >= 0) {
    transactions[existingIndex] = transaction;
  } else {
    transactions.push(transaction);
  }
  await Bun.write(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
}

export async function deleteTransaction(id: string): Promise<void> {
  const transactions = await getTransactions();
  const filtered = transactions.filter((t) => t.id !== id);
  await Bun.write(TRANSACTIONS_FILE, JSON.stringify(filtered, null, 2));
}
