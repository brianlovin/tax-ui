import { z } from "zod";

/**
 * Robustly extract and validate JSON from an LLM response string.
 * Tries: direct parse, strip markdown fences, regex extract, then Zod validation.
 */
export function extractJson<T>(text: string, schema: z.ZodType<T>): T {
  // 1. Try direct parse
  const direct = tryParse(text);
  if (direct !== undefined) {
    const result = schema.safeParse(direct);
    if (result.success) return result.data;
  }

  // 2. Strip markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "");
  if (stripped !== text) {
    const fenced = tryParse(stripped);
    if (fenced !== undefined) {
      const result = schema.safeParse(fenced);
      if (result.success) return result.data;
    }
  }

  // 3. Regex extract object or array
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const extracted = tryParse(objectMatch[0]);
    if (extracted !== undefined) {
      const result = schema.safeParse(extracted);
      if (result.success) return result.data;
    }
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const extracted = tryParse(arrayMatch[0]);
    if (extracted !== undefined) {
      const result = schema.safeParse(extracted);
      if (result.success) return result.data;
    }
  }

  throw new Error(`Failed to extract valid JSON from response: ${text.slice(0, 200)}`);
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Extract a JSON array from an LLM response string.
 */
export function extractJsonArray(text: string): unknown[] {
  const direct = tryParse(text);
  if (Array.isArray(direct)) return direct;

  const stripped = text.replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "");
  if (stripped !== text) {
    const fenced = tryParse(stripped);
    if (Array.isArray(fenced)) return fenced;
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const extracted = tryParse(arrayMatch[0]);
    if (Array.isArray(extracted)) return extracted;
  }

  throw new Error(`Failed to extract JSON array from response: ${text.slice(0, 200)}`);
}
