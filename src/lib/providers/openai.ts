import OpenAI from "openai";
import { toJSONSchema } from "zod";

import type { PageClassification } from "../classifier";
import { type TaxReturn, TaxReturnSchema } from "../schema";
import { extractJson, extractJsonArray } from "./json-utils";
import type { ChatMessage, LLMProvider } from "./types";

const HEAVY_MODEL = "gpt-4o";
const LIGHT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async parseTaxChunk(pdfBase64: string, prompt: string): Promise<TaxReturn> {
    const response = await this.client.responses.create({
      model: HEAVY_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: "tax-return.pdf",
              file_data: `data:application/pdf;base64,${pdfBase64}`,
            },
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "tax_return",
          schema: toJSONSchema(TaxReturnSchema) as Record<string, unknown>,
        },
      },
    });

    const text = response.output_text;
    return extractJson(text, TaxReturnSchema);
  }

  async classifyPages(pdfBase64: string, prompt: string): Promise<PageClassification[]> {
    const response = await this.client.responses.create({
      model: LIGHT_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: "tax-return.pdf",
              file_data: `data:application/pdf;base64,${pdfBase64}`,
            },
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = response.output_text;
    const parsed = extractJsonArray(text) as Array<{ page: number; type: string }>;

    return parsed.map((item) => ({
      pageNumber: item.page,
      formType: item.type as PageClassification["formType"],
    }));
  }

  async extractYear(pdfBase64: string, prompt: string): Promise<string> {
    const response = await this.client.responses.create({
      model: LIGHT_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: "tax-return.pdf",
              file_data: `data:application/pdf;base64,${pdfBase64}`,
            },
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
    });

    return response.output_text;
  }

  async chat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
    const response = await this.client.responses.create({
      model: HEAVY_MODEL,
      instructions: systemPrompt,
      input: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    return response.output_text || "No response";
  }

  async suggestions(systemPrompt: string, messages: ChatMessage[]): Promise<string[]> {
    const response = await this.client.responses.create({
      model: LIGHT_MODEL,
      instructions: systemPrompt,
      input: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      text: {
        format: {
          type: "json_schema",
          name: "suggestions",
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = response.output_text;
    try {
      const parsed = JSON.parse(text);
      const items = parsed.suggestions ?? parsed;
      return (Array.isArray(items) ? items : []).slice(0, 3);
    } catch {
      return [];
    }
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.responses.create({
        model: LIGHT_MODEL,
        input: [{ role: "user", content: "hi" }],
        max_output_tokens: 1,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.includes("authentication") ||
        message.includes("401") ||
        message.includes("API key") ||
        message.includes("Incorrect API key")
      ) {
        return false;
      }
      return true;
    }
  }
}
