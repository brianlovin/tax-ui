import OpenAI from "openai";

import type { PageClassification } from "../classifier";
import { extractPdfText } from "../pdf-text";
import type { TaxReturn } from "../schema";
import { TaxReturnSchema } from "../schema";
import { extractJson, extractJsonArray } from "./json-utils";
import type { ChatMessage, LLMProvider } from "./types";

const TAX_RETURN_EXAMPLE = `{
  "year": 2024,
  "name": "John Smith",
  "country": "US",
  "filingStatus": "Married Filing Jointly",
  "dependents": [{ "name": "Jane Smith", "relationship": "daughter" }],
  "income": {
    "items": [
      { "label": "W-2 wages", "amount": 150000 },
      { "label": "Interest income", "amount": 1200 }
    ],
    "total": 151200
  },
  "federal": {
    "agi": 151200,
    "deductions": [{ "label": "− Standard deduction", "amount": 29200 }],
    "taxableIncome": 122000,
    "tax": 18200,
    "additionalTaxes": [],
    "credits": [{ "label": "Child tax credit", "amount": 2000 }],
    "payments": [{ "label": "Federal withholding", "amount": 20000 }],
    "refundOrOwed": 3800
  },
  "states": [
    {
      "name": "California",
      "agi": 151200,
      "deductions": [{ "label": "− Standard deduction", "amount": 10726 }],
      "taxableIncome": 140474,
      "tax": 8500,
      "adjustments": [],
      "payments": [{ "label": "CA withholding", "amount": 9000 }],
      "refundOrOwed": 500
    }
  ],
  "summary": {
    "federalAmount": 3800,
    "stateAmounts": [{ "state": "California", "amount": 500 }],
    "netPosition": 4300
  }
}`;

export class LocalProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private supportsResponseFormat: boolean | null = null;

  constructor(baseUrl: string, model: string) {
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: "ollama", // Ollama doesn't require a real key
    });
    this.model = model;
  }

  private async createJsonCompletion(
    messages: OpenAI.ChatCompletionMessageParam[],
  ): Promise<string> {
    // Try with response_format if we haven't determined it's unsupported
    if (this.supportsResponseFormat !== false) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          response_format: { type: "json_object" },
        });
        this.supportsResponseFormat = true;
        return response.choices[0]?.message?.content ?? "";
      } catch (e) {
        // If this is the first attempt, fall through to retry without response_format
        if (this.supportsResponseFormat === null) {
          console.warn("response_format not supported, falling back to prompt-only JSON");
          this.supportsResponseFormat = false;
        } else {
          throw e;
        }
      }
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
    });
    return response.choices[0]?.message?.content ?? "";
  }

  async parseTaxChunk(pdfBase64: string, prompt: string): Promise<TaxReturn> {
    const pdfText = await extractPdfText(pdfBase64);
    const text = await this.createJsonCompletion([
      {
        role: "user",
        content: `Here is the extracted text from a PDF tax document:\n\n${pdfText}\n\n${prompt}\n\nRespond with ONLY valid JSON matching the structure below. No markdown fences, no explanation.\n\nExample structure:\n${TAX_RETURN_EXAMPLE}`,
      },
    ]);

    return extractJson(text, TaxReturnSchema);
  }

  async classifyPages(pdfBase64: string, prompt: string): Promise<PageClassification[]> {
    const pdfText = await extractPdfText(pdfBase64);
    const text = await this.createJsonCompletion([
      {
        role: "user",
        content: `Here is the extracted text from a PDF tax document:\n\n${pdfText}\n\n${prompt}\n\nRespond with ONLY a valid JSON array. No markdown fences.`,
      },
    ]);

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
    const text = await this.createJsonCompletion([
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
    ]);

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
