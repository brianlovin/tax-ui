import { serve } from "bun";
import Anthropic from "@anthropic-ai/sdk";
import { getReturns, saveReturn, deleteReturn, getApiKey, saveApiKey, clearAllData } from "./lib/storage";
import { parseTaxReturn, extractYearFromPdf } from "./lib/parser";
import index from "./index.html";

function buildChatSystemPrompt(returns: Record<number, unknown>): string {
  const years = Object.keys(returns).map(Number).sort((a, b) => a - b);
  const yearRange = years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years[0]?.toString() || "none";

  return `You are a helpful tax data analysis assistant. You have access to the user's tax return data.

IMPORTANT FORMATTING RULES:
- Format all currency values with $ and commas (e.g., $1,234,567)
- Format percentages to 1 decimal place (e.g., 22.5%)
- Be concise and direct in your responses
- When comparing years, show values side by side

TAX DATA AVAILABLE:
Years: ${yearRange}
${JSON.stringify(returns, null, 2)}

Answer questions about the user's income, taxes, deductions, credits, and tax rates based on this data.`;
}

const server = serve({
  routes: {
    "/api/config": {
      GET: () => {
        const hasKey = Boolean(getApiKey());
        const isDemo = process.env.DEMO_MODE === "true";
        const isDev = process.env.NODE_ENV !== "production";
        return Response.json({ hasKey, isDemo, isDev });
      },
    },
    "/api/config/key": {
      POST: async (req) => {
        const { apiKey } = await req.json();
        if (!apiKey || typeof apiKey !== "string") {
          return Response.json({ error: "Invalid API key" }, { status: 400 });
        }
        await saveApiKey(apiKey.trim());
        return Response.json({ success: true });
      },
    },
    "/api/clear-data": {
      POST: async () => {
        await clearAllData();
        return Response.json({ success: true });
      },
    },
    "/api/returns": {
      GET: async () => {
        return Response.json(await getReturns());
      },
    },
    "/api/returns/:year": {
      DELETE: async (req) => {
        const year = Number(req.params.year);
        if (isNaN(year)) {
          return Response.json({ error: "Invalid year" }, { status: 400 });
        }
        await deleteReturn(year);
        return Response.json({ success: true });
      },
    },
    "/api/extract-year": {
      POST: async (req) => {
        const formData = await req.formData();
        const file = formData.get("pdf") as File | null;

        if (!file) {
          return Response.json({ error: "No PDF file provided" }, { status: 400 });
        }

        const apiKey = getApiKey();
        if (!apiKey) {
          return Response.json({ error: "No API key configured" }, { status: 400 });
        }

        try {
          const buffer = await file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const year = await extractYearFromPdf(base64, apiKey);
          return Response.json({ year });
        } catch (error) {
          console.error("Year extraction error:", error);
          return Response.json({ year: null });
        }
      },
    },
    "/api/chat": {
      POST: async (req) => {
        const { prompt, history, returns: clientReturns } = await req.json();

        if (!prompt || typeof prompt !== "string") {
          return Response.json({ error: "No prompt provided" }, { status: 400 });
        }

        const apiKey = getApiKey();
        if (!apiKey) {
          return Response.json({ error: "No API key configured" }, { status: 400 });
        }

        // Use client-provided returns (for dev sample data) or fall back to stored returns
        const returns = clientReturns && Object.keys(clientReturns).length > 0
          ? clientReturns
          : await getReturns();
        const client = new Anthropic({ apiKey });

        try {
          // Build messages from history
          const messages: Anthropic.MessageParam[] = [];
          for (const msg of history || []) {
            messages.push({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            });
          }
          messages.push({ role: "user", content: prompt });

          const response = await client.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 2048,
            system: buildChatSystemPrompt(returns),
            messages,
          });

          const textBlock = response.content.find((block) => block.type === "text");
          const responseText = textBlock?.type === "text" ? textBlock.text : "No response";

          return Response.json({ response: responseText });
        } catch (error) {
          console.error("Chat error:", error);
          const message = error instanceof Error ? error.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/api/suggestions": {
      POST: async (req) => {
        const { history, returns: clientReturns } = await req.json();

        const apiKey = getApiKey();
        if (!apiKey) {
          return Response.json({ suggestions: [] });
        }

        const returns = clientReturns && Object.keys(clientReturns).length > 0
          ? clientReturns
          : await getReturns();

        const client = new Anthropic({ apiKey });

        try {
          const messages: Anthropic.MessageParam[] = history.map((msg: { role: string; content: string }) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));
          // Structured outputs don't allow assistant messages in final position
          messages.push({ role: "user", content: "Suggest 3 follow-up questions I might ask." });

          const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 256,
            system: `You are helping a user explore their own tax return data. Generate 3 short follow-up questions the user might want to ask about their finances. Phrase questions in FIRST PERSON (e.g., "Why did my income drop?" not "Why did your income drop?").`,
            messages,
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
          const suggestions = JSON.parse(textBlock?.type === "text" ? textBlock.text : "[]");

          return Response.json({ suggestions: suggestions.slice(0, 3) });
        } catch (error) {
          console.error("Suggestions error:", error);
          return Response.json({ suggestions: [] });
        }
      },
    },
    "/api/parse": {
      POST: async (req) => {
        const formData = await req.formData();
        const file = formData.get("pdf") as File | null;
        const apiKeyFromForm = formData.get("apiKey") as string | null;

        if (!file) {
          return Response.json({ error: "No PDF file provided" }, { status: 400 });
        }

        const apiKey = apiKeyFromForm?.trim() || getApiKey();
        if (!apiKey) {
          return Response.json({ error: "No API key provided" }, { status: 400 });
        }

        // Save key to .env if provided via form
        if (apiKeyFromForm?.trim()) {
          await saveApiKey(apiKeyFromForm.trim());
        }

        try {
          const buffer = await file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const taxReturn = await parseTaxReturn(base64, apiKey);
          await saveReturn(taxReturn);
          return Response.json(taxReturn);
        } catch (error) {
          console.error("Parse error:", error);
          const message = error instanceof Error ? error.message : "Unknown error";

          if (message.includes("authentication") || message.includes("API key")) {
            return Response.json({ error: "Invalid API key" }, { status: 401 });
          }
          if (message.includes("prompt is too long") || message.includes("too many tokens")) {
            return Response.json({ error: "PDF is too large to process. Try uploading just the main tax forms." }, { status: 400 });
          }
          if (message.includes("JSON")) {
            return Response.json({ error: "Failed to parse tax return data" }, { status: 422 });
          }
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
