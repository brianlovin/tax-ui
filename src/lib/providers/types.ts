import type { PageClassification } from "../classifier";
import type { TaxReturn } from "../schema";

export type ProviderType = "anthropic" | "openai" | "local";

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string; // empty for local
  baseUrl?: string; // only for local (e.g. http://localhost:11434/v1)
  model?: string; // only for local (user-selected model name)
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  parseTaxChunk(pdfBase64: string, prompt: string): Promise<TaxReturn>;
  classifyPages(pdfBase64: string, prompt: string): Promise<PageClassification[]>;
  extractYear(pdfBase64: string, prompt: string): Promise<string>;
  chat(systemPrompt: string, messages: ChatMessage[]): Promise<string>;
  suggestions(systemPrompt: string, messages: ChatMessage[]): Promise<string[]>;
  validate(): Promise<boolean>;
}
