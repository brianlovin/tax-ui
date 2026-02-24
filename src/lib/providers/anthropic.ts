import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { PageClassification } from "../classifier";
import { type TaxReturn, TaxReturnSchema } from "../schema";
import type { ChatMessage, LLMProvider } from "./types";

const HEAVY_MODEL = "claude-sonnet-4-5-20250929";
const LIGHT_MODEL = "claude-haiku-4-5-20251001";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async parseTaxChunk(pdfBase64: string, prompt: string): Promise<TaxReturn> {
    const response = await this.client.messages.create({
      model: HEAVY_MODEL,
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
              text: prompt,
            },
          ],
        },
      ],
      output_config: {
        format: zodOutputFormat(TaxReturnSchema),
      },
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    return JSON.parse(textBlock.text);
  }

  async classifyPages(pdfBase64: string, prompt: string): Promise<PageClassification[]> {
    const response = await this.client.messages.create({
      model: LIGHT_MODEL,
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
              text: prompt,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No classification response from Claude");
    }

    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Could not parse classification response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      page: number;
      type: string;
    }>;

    return parsed.map((item) => ({
      pageNumber: item.page,
      formType: item.type as PageClassification["formType"],
    }));
  }

  async extractYear(pdfBase64: string, prompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: LIGHT_MODEL,
      max_tokens: 50,
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
              text: prompt,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return "UNKNOWN";
    }

    return textBlock.text;
  }

  async chat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
    const response = await this.client.messages.create({
      model: HEAVY_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "No response";
  }

  async suggestions(systemPrompt: string, messages: ChatMessage[]): Promise<string[]> {
    const response = await this.client.messages.create({
      model: LIGHT_MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const parsed = JSON.parse(textBlock?.type === "text" ? textBlock.text : "[]");
    return parsed.slice(0, 3);
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: LIGHT_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.includes("authentication") ||
        message.includes("401") ||
        message.includes("API key")
      ) {
        return false;
      }
      // Other errors (rate limit, etc.) — key is probably valid
      return true;
    }
  }
}
