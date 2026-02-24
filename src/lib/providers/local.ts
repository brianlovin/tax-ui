import OpenAI from "openai";

import type { PageClassification } from "../classifier";
import { extractPdfText } from "../pdf-text";
import type { TaxReturn } from "../schema";
import { TaxReturnSchema } from "../schema";
import { extractJson, extractJsonArray } from "./json-utils";
import type { ChatMessage, LLMProvider } from "./types";

export class LocalProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: "ollama", // Ollama doesn't require a real key
    });
    this.model = model;
  }

  async parseTaxChunk(pdfBase64: string, prompt: string): Promise<TaxReturn> {
    const pdfText = await extractPdfText(pdfBase64);
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "user",
          content: `Here is the extracted text from a PDF tax document:\n\n${pdfText}\n\n${prompt}\n\nRespond with ONLY valid JSON matching the required schema. No markdown fences.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    return extractJson(text, TaxReturnSchema);
  }

  async classifyPages(pdfBase64: string, prompt: string): Promise<PageClassification[]> {
    const pdfText = await extractPdfText(pdfBase64);
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "user",
          content: `Here is the extracted text from a PDF tax document:\n\n${pdfText}\n\n${prompt}\n\nRespond with ONLY a valid JSON array. No markdown fences.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = extractJsonArray(text) as Array<{ page: number; type: string }>;

    return parsed.map((item) => ({
      pageNumber: item.page,
      formType: item.type as PageClassification["formType"],
    }));
  }

  async extractYear(pdfBase64: string, prompt: string): Promise<string> {
    const pdfText = await extractPdfText(pdfBase64);
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "user",
          content: `Here is the extracted text from a PDF tax document:\n\n${pdfText}\n\n${prompt}`,
        },
      ],
    });

    return response.choices[0]?.message?.content ?? "UNKNOWN";
  }

  async chat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    return response.choices[0]?.message?.content ?? "No response";
  }

  async suggestions(systemPrompt: string, messages: ChatMessage[]): Promise<string[]> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        {
          role: "user",
          content:
            "Respond with ONLY a JSON array of 3 short follow-up question strings. No explanation.",
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "[]";
    try {
      const parsed = extractJsonArray(text);
      return (parsed as string[]).slice(0, 3);
    } catch {
      return [];
    }
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}
