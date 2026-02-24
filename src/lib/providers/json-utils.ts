import { z } from "zod";

/**
 * Robustly extract and validate JSON from an LLM response string.
 * Tries: direct parse, strip markdown fences, regex extract, then Zod validation.
 */
export function extractJson<T>(text: string, schema: z.ZodType<T>): T {
  let lastZodError: z.ZodError | undefined;
  let jsonParsed = false;

  function tryValidate(raw: unknown): T | undefined {
    jsonParsed = true;
    const result = schema.safeParse(raw);
    if (result.success) return result.data;
    lastZodError = result.error;
    return undefined;
  }

  // 1. Try direct parse
  const direct = tryParse(text);
  if (direct !== undefined) {
    const result = tryValidate(direct);
    if (result !== undefined) return result;
  }

  // 2. Strip markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "");
  if (stripped !== text) {
    const fenced = tryParse(stripped);
    if (fenced !== undefined) {
      const result = tryValidate(fenced);
      if (result !== undefined) return result;
    }
  }

  // 3. Regex extract object or array
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const extracted = tryParse(objectMatch[0]);
    if (extracted !== undefined) {
      const result = tryValidate(extracted);
      if (result !== undefined) return result;
    }
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const extracted = tryParse(arrayMatch[0]);
    if (extracted !== undefined) {
      const result = tryValidate(extracted);
      if (result !== undefined) return result;
    }
  }

  if (jsonParsed && lastZodError) {
    const issues = lastZodError.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`JSON parsed but failed schema validation:\n${issues}`);
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
