import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
export type AIProvider = "anthropic" | "openai" | "google" | "gateway";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
}

// Detect if key is a Vercel AI Gateway key
export function isGatewayKey(apiKey: string): boolean {
  return apiKey.startsWith("vck_");
}

// Model IDs for direct provider access
const FAST_MODEL_MAP: Record<Exclude<AIProvider, "gateway">, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
};

const MAIN_MODEL_MAP: Record<Exclude<AIProvider, "gateway">, string> = {
  anthropic: "claude-sonnet-4-5-20250929",
  openai: "gpt-4o",
  google: "gemini-2.0-pro",
};

// Model IDs for Vercel AI Gateway (uses provider/model format)
const GATEWAY_FAST_MODEL = "anthropic/claude-haiku-4-5-20251001";
const GATEWAY_MAIN_MODEL = "anthropic/claude-sonnet-4-5-20250929";
function getAnthropicClient(apiKey: string) {
  return createAnthropic({ apiKey });
}

function getOpenAIClient(apiKey: string) {
  return createOpenAI({ apiKey });
}

function getGoogleClient(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}

function getGatewayClient(apiKey: string) {
  return createGateway({ apiKey });
}

export function getClient(config: AIConfig) {
  // Gateway key detected - use gateway regardless of provider setting
  if (isGatewayKey(config.apiKey)) {
    return getGatewayClient(config.apiKey);
  }

  // Direct provider access
  switch (config.provider) {
    case "anthropic":
      return getAnthropicClient(config.apiKey);
    case "openai":
      return getOpenAIClient(config.apiKey);
    case "google":
      return getGoogleClient(config.apiKey);
    case "gateway":
      return getGatewayClient(config.apiKey);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getFastModel(config: AIConfig) {
  const client = getClient(config);

  // Gateway uses prefixed model names
  if (isGatewayKey(config.apiKey) || config.provider === "gateway") {
    return client.languageModel(GATEWAY_FAST_MODEL);
  }

  return client.languageModel(FAST_MODEL_MAP[config.provider]);
}

export function getMainModel(config: AIConfig) {
  const client = getClient(config);

  // Gateway uses prefixed model names
  if (isGatewayKey(config.apiKey) || config.provider === "gateway") {
    return client.languageModel(GATEWAY_MAIN_MODEL);
  }

  return client.languageModel(MAIN_MODEL_MAP[config.provider]);
}

export async function generateTextFromPDF(
  config: AIConfig,
  pdfBase64: string,
  prompt: string,
  options?: { maxTokens?: number },
): Promise<string> {
  const model = getMainModel(config);

  const response = await generateText({
    model,
    maxOutputTokens: options?.maxTokens ?? 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: `data:application/pdf;base64,${pdfBase64}`,
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  return response.text;
}

export async function generateObjectFromPDF<T extends z.ZodSchema>(
  config: AIConfig,
  pdfBase64: string,
  prompt: string,
  schema: T,
  options?: { maxTokens?: number },
): Promise<z.infer<T>> {
  const model = getMainModel(config);

  const { output } = await generateText({
    model,
    output: Output.object({ schema }),
    maxOutputTokens: options?.maxTokens ?? 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: `data:application/pdf;base64,${pdfBase64}`,
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  return output as z.infer<T>;
}

export async function generateTextFromPDFFast(
  config: AIConfig,
  pdfBase64: string,
  prompt: string,
  options?: { maxTokens?: number },
): Promise<string> {
  const model = getFastModel(config);

  const response = await generateText({
    model,
    maxOutputTokens: options?.maxTokens ?? 256,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: `data:application/pdf;base64,${pdfBase64}`,
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  return response.text;
}

export async function generateChatResponse(
  config: AIConfig,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { maxTokens?: number },
): Promise<string> {
  const model = getMainModel(config);

  const response = await generateText({
    model,
    system: systemPrompt,
    maxOutputTokens: options?.maxTokens ?? 2048,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return response.text;
}

export async function generateSuggestions(
  config: AIConfig,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
): Promise<string[]> {
  const model = getFastModel(config);

  const messages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  messages.push({ role: "user", content: "Suggest 3 follow-up questions I might ask." });

  const { output } = await generateText({
    model,
    system: systemPrompt,
    output: Output.object({
      schema: z.object({
        suggestions: z.array(z.string()),
      }),
    }),
    maxOutputTokens: 256,
    messages,
  });

  return (output as { suggestions: string[] }).suggestions.slice(0, 3);
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("authentication") ||
      message.includes("401") ||
      message.includes("api key") ||
      message.includes("invalid") ||
      message.includes("unauthorized")
    );
  }
  return false;
}
