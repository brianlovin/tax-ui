import path from "path";

import { type TaxReturn, TaxReturnSchema } from "./schema";

const DATA_DIR = process.env.TAX_UI_DATA_DIR || process.cwd();
const RETURNS_FILE = path.join(DATA_DIR, ".tax-returns.json");
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

export function getApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

export async function saveApiKey(key: string): Promise<void> {
  const file = Bun.file(ENV_FILE);
  let content = "";

  if (await file.exists()) {
    content = await file.text();
    if (content.includes("ANTHROPIC_API_KEY=")) {
      content = content.replace(/ANTHROPIC_API_KEY=.*/g, `ANTHROPIC_API_KEY=${key}`);
    } else {
      content = content.trim() + `\nANTHROPIC_API_KEY=${key}\n`;
    }
  } else {
    content = `ANTHROPIC_API_KEY=${key}\n`;
  }

  await Bun.write(ENV_FILE, content);
  process.env.ANTHROPIC_API_KEY = key;
}

export async function removeApiKey(): Promise<void> {
  const envFile = Bun.file(ENV_FILE);
  if (await envFile.exists()) {
    let content = await envFile.text();
    content = content.replace(/^ANTHROPIC_API_KEY=.*$/gm, "").trim();
    if (content) {
      await Bun.write(ENV_FILE, content + "\n");
    } else {
      const fs = await import("fs/promises");
      await fs.unlink(ENV_FILE);
    }
  }
  delete process.env.ANTHROPIC_API_KEY;
}

export async function clearAllData(): Promise<void> {
  // Clear tax returns
  const returnsFile = Bun.file(RETURNS_FILE);
  if (await returnsFile.exists()) {
    await Bun.write(RETURNS_FILE, "{}");
  }

  // Clear API key from .env
  const envFile = Bun.file(ENV_FILE);
  if (await envFile.exists()) {
    let content = await envFile.text();
    content = content.replace(/^ANTHROPIC_API_KEY=.*$/gm, "").trim();
    if (content) {
      await Bun.write(ENV_FILE, content + "\n");
    } else {
      // Delete empty .env file
      const fs = await import("fs/promises");
      await fs.unlink(ENV_FILE);
    }
  }
  delete process.env.ANTHROPIC_API_KEY;
}
