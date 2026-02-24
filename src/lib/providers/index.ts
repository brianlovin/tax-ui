import { AnthropicProvider } from "./anthropic";
import { LocalProvider } from "./local";
import { OpenAIProvider } from "./openai";
import type { LLMProvider, ProviderConfig, ProviderType } from "./types";

export type { ChatMessage, LLMProvider, ProviderConfig, ProviderType } from "./types";

export function detectProvider(apiKey: string): ProviderType | null {
  if (!apiKey) return null;
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("sk-")) return "openai";
  return null;
}

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case "anthropic":
      return new AnthropicProvider(config.apiKey);
    case "openai":
      return new OpenAIProvider(config.apiKey);
    case "local":
      return new LocalProvider(config.baseUrl!, config.model!);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}
