import { extractText } from "unpdf";

/** Extract all text from a base64-encoded PDF, merging all pages into one string. */
export async function extractPdfText(base64: string): Promise<string> {
  const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { text } = await extractText(data, { mergePages: true });
  return text;
}
