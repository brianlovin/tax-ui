import path from "path";

import type { ProviderConfig, ProviderType } from "./providers/types";
import { type TaxReturn, TaxReturnSchema } from "./schema";

const DATA_DIR = process.env.TAX_UI_DATA_DIR || process.cwd();
const RETURNS_FILE = path.join(DATA_DIR, ".tax-returns.json");
const ENV_FILE = path.join(DATA_DIR, ".env");

const PROVIDER_ENV_KEYS = ["LLM_PROVIDER", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"];
const ALL_MANAGED_KEYS = [...PROVIDER_ENV_KEYS, "ANTHROPIC_API_KEY"];

// Backfill missing array fields for old stored data, then validate with Zod
function migrate(data: Record<number, unknown>): Record<number, TaxReturn> {
  const result: Record<number, TaxReturn> = {};
  for (const [year, raw] of Object.entries(data)) {
    const ret = raw as Record<string, unknown>;
    const fed = (ret.federal ?? {}) as Record<string, unknown>;
    const patched = {
      ...ret,
      country: ret.country ?? "US",
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

// --- Provider config ---

export function getProviderConfig(): ProviderConfig | null {
  // Check new multi-provider env vars first
  const providerType = process.env.LLM_PROVIDER as ProviderType | undefined;
  const apiKey = process.env.LLM_API_KEY;

  if (providerType && (apiKey || providerType === "local")) {
    return {
      type: providerType,
      apiKey: apiKey ?? "",
      baseUrl: process.env.LLM_BASE_URL || undefined,
      model: process.env.LLM_MODEL || undefined,
    };
  }

  // Backward compatibility: read legacy ANTHROPIC_API_KEY
  const legacyKey = process.env.ANTHROPIC_API_KEY;
  if (legacyKey) {
    return { type: "anthropic", apiKey: legacyKey };
  }

  return null;
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  const file = Bun.file(ENV_FILE);
  let content = "";

  if (await file.exists()) {
    content = await file.text();
  }

  // Remove all managed keys
  for (const key of ALL_MANAGED_KEYS) {
    content = content.replace(new RegExp(`^${key}=.*$`, "gm"), "");
  }

  // Clean up blank lines
  content = content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");

  // Append new config
  const lines: string[] = [];
  lines.push(`LLM_PROVIDER=${config.type}`);
  lines.push(`LLM_API_KEY=${config.apiKey}`);
  if (config.baseUrl) lines.push(`LLM_BASE_URL=${config.baseUrl}`);
  if (config.model) lines.push(`LLM_MODEL=${config.model}`);

  content = content ? content + "\n" + lines.join("\n") + "\n" : lines.join("\n") + "\n";

  await Bun.write(ENV_FILE, content);

  // Update process.env
  process.env.LLM_PROVIDER = config.type;
  process.env.LLM_API_KEY = config.apiKey;
  if (config.baseUrl) process.env.LLM_BASE_URL = config.baseUrl;
  else delete process.env.LLM_BASE_URL;
  if (config.model) process.env.LLM_MODEL = config.model;
  else delete process.env.LLM_MODEL;
  // Clean up legacy key
  delete process.env.ANTHROPIC_API_KEY;
}

export async function removeProviderConfig(): Promise<void> {
  const envFile = Bun.file(ENV_FILE);
  if (await envFile.exists()) {
    let content = await envFile.text();
    for (const key of ALL_MANAGED_KEYS) {
      content = content.replace(new RegExp(`^${key}=.*$`, "gm"), "");
    }
    content = content
      .split("\n")
      .filter((line) => line.trim() !== "")
      .join("\n");
    if (content) {
      await Bun.write(ENV_FILE, content + "\n");
    } else {
      const fs = await import("fs/promises");
      await fs.unlink(ENV_FILE);
    }
  }
  for (const key of ALL_MANAGED_KEYS) {
    delete process.env[key];
  }
}

// --- Legacy API (kept for backward compatibility, delegates to new functions) ---

export function getApiKey(): string | undefined {
  const config = getProviderConfig();
  return config?.apiKey || undefined;
}

export async function saveApiKey(key: string): Promise<void> {
  // Auto-detect provider type
  let type: ProviderType = "anthropic";
  if (key.startsWith("sk-ant-")) type = "anthropic";
  else if (key.startsWith("sk-")) type = "openai";

  await saveProviderConfig({ type, apiKey: key });
}

export async function removeApiKey(): Promise<void> {
  await removeProviderConfig();
}

export async function clearAllData(): Promise<void> {
  // Clear tax returns
  const returnsFile = Bun.file(RETURNS_FILE);
  if (await returnsFile.exists()) {
    await Bun.write(RETURNS_FILE, "{}");
  }

  // Clear provider config
  await removeProviderConfig();
}
