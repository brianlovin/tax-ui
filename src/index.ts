import { argv, serve } from "bun";
import path from "path";
import { fileURLToPath } from "url";

import index from "./index.html";
import { extractYearFromPdf, parseTaxReturn } from "./lib/parser";
import {
  createProvider,
  detectProvider,
  type LLMProvider,
  type ProviderConfig,
} from "./lib/providers";
import {
  clearAllData,
  deleteReturn,
  getProviderConfig,
  getReturns,
  removeProviderConfig,
  saveProviderConfig,
  saveReturn,
} from "./lib/storage";

function isAuthError(message: string): boolean {
  return (
    message.includes("authentication") ||
    message.includes("401") ||
    message.includes("API key") ||
    message.includes("Incorrect API key")
  );
}

function getProvider(overrideConfig?: ProviderConfig | null): LLMProvider | null {
  const config = overrideConfig ?? getProviderConfig();
  if (!config) return null;
  return createProvider(config);
}

// Parse --port from command line args (supports --port=XXXX or --port XXXX)
function parsePort(): number {
  const idx = argv.findIndex((arg) => arg === "--port" || arg.startsWith("--port="));
  if (idx === -1) return 3000;
  const arg = argv[idx]!;
  if (arg.startsWith("--port=")) return Number(arg.split("=")[1]);
  return Number(argv[idx + 1]) || 3000;
}
const port = parsePort();
const isProd = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_ROOT = process.env.TAX_UI_STATIC_DIR || __dirname;

function buildChatSystemPrompt(returns: Record<number, unknown>): string {
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => a - b);
  const yearRange =
    years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years[0]?.toString() || "none";

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

const routes: Record<string, any> = {
  "/api/config": {
    GET: () => {
      const config = getProviderConfig();
      const hasKey = Boolean(config);
      const providerType = config?.type ?? null;
      const isDemo = process.env.DEMO_MODE === "true";
      const isDev = process.env.NODE_ENV !== "production";
      return Response.json({ hasKey, providerType, isDemo, isDev });
    },
  },
  "/api/config/key": {
    POST: async (req: Request) => {
      const body = await req.json();
      const { apiKey, providerType, baseUrl, model } = body;

      // For local provider, no API key needed
      if (providerType === "local") {
        if (!baseUrl) {
          return Response.json({ error: "Base URL is required for local model" }, { status: 400 });
        }
        if (!model) {
          return Response.json({ error: "Model is required for local model" }, { status: 400 });
        }

        const config: ProviderConfig = { type: "local", apiKey: "", baseUrl, model };
        const provider = createProvider(config);
        const valid = await provider.validate();
        if (!valid) {
          return Response.json(
            { error: "Could not connect to local model. Check URL and model name." },
            { status: 400 },
          );
        }

        await saveProviderConfig(config);
        return Response.json({ success: true, providerType: "local" });
      }

      // Cloud providers need an API key
      if (!apiKey || typeof apiKey !== "string") {
        return Response.json({ error: "Invalid API key" }, { status: 400 });
      }

      const trimmedKey = apiKey.trim();

      // Auto-detect provider type if not specified
      const detectedType = providerType ?? detectProvider(trimmedKey);
      if (!detectedType) {
        return Response.json(
          {
            error:
              "Could not detect provider from API key. Key should start with sk-ant- (Anthropic) or sk- (OpenAI).",
          },
          { status: 400 },
        );
      }

      const config: ProviderConfig = { type: detectedType, apiKey: trimmedKey };

      // Validate the key
      const provider = createProvider(config);
      const valid = await provider.validate();
      if (!valid) {
        return Response.json({ error: "Invalid API key" }, { status: 401 });
      }

      await saveProviderConfig(config);
      return Response.json({ success: true, providerType: detectedType });
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
    DELETE: async (req: Request & { params: { year: string } }) => {
      const year = Number(req.params.year);
      if (isNaN(year)) {
        return Response.json({ error: "Invalid year" }, { status: 400 });
      }
      await deleteReturn(year);
      return Response.json({ success: true });
    },
  },
  "/api/extract-year": {
    POST: async (req: Request) => {
      const formData = await req.formData();
      const file = formData.get("pdf") as File | null;

      if (!file) {
        return Response.json({ error: "No PDF file provided" }, { status: 400 });
      }

      // Support form-submitted provider config for one-off use during onboarding
      const formApiKey = formData.get("apiKey") as string | null;
      const formProviderType = formData.get("providerType") as string | null;
      const formBaseUrl = formData.get("baseUrl") as string | null;
      const formModel = formData.get("model") as string | null;
      let provider: LLMProvider | null = null;

      if (formProviderType === "local" && formBaseUrl && formModel) {
        provider = createProvider({
          type: "local",
          apiKey: "",
          baseUrl: formBaseUrl,
          model: formModel,
        });
      } else if (formApiKey?.trim()) {
        const detected = detectProvider(formApiKey.trim());
        if (detected) {
          provider = createProvider({ type: detected, apiKey: formApiKey.trim() });
        }
      }
      if (!provider) {
        provider = getProvider();
      }
      if (!provider) {
        return Response.json({ error: "No API key configured" }, { status: 400 });
      }

      try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const year = await extractYearFromPdf(base64, provider);
        return Response.json({ year });
      } catch (error) {
        console.error("Year extraction error:", error);
        const message = error instanceof Error ? error.message : "";
        if (isAuthError(message)) {
          await removeProviderConfig();
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        return Response.json({
          year: null,
          error: error instanceof Error ? error.message : "Year extraction failed",
        });
      }
    },
  },
  "/api/chat": {
    POST: async (req: Request) => {
      const { prompt, history, returns: clientReturns } = await req.json();

      if (!prompt || typeof prompt !== "string") {
        return Response.json({ error: "No prompt provided" }, { status: 400 });
      }

      const provider = getProvider();
      if (!provider) {
        return Response.json({ error: "No API key configured" }, { status: 400 });
      }

      // Use client-provided returns (for dev sample data) or fall back to stored returns
      const returns =
        clientReturns && Object.keys(clientReturns).length > 0 ? clientReturns : await getReturns();

      try {
        // Build messages from history
        const messages: { role: "user" | "assistant"; content: string }[] = [];
        for (const msg of history || []) {
          messages.push({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          });
        }
        messages.push({ role: "user", content: prompt });

        const responseText = await provider.chat(buildChatSystemPrompt(returns), messages);

        return Response.json({ response: responseText });
      } catch (error) {
        console.error("Chat error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        if (isAuthError(message)) {
          await removeProviderConfig();
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        return Response.json({ error: message }, { status: 500 });
      }
    },
  },
  "/api/suggestions": {
    POST: async (req: Request) => {
      const { history } = await req.json();

      const provider = getProvider();
      if (!provider) {
        return Response.json({ suggestions: [] });
      }

      try {
        const messages: { role: "user" | "assistant"; content: string }[] = history.map(
          (msg: { role: string; content: string }) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }),
        );
        // Add the suggestion request as a user message
        messages.push({ role: "user", content: "Suggest 3 follow-up questions I might ask." });

        const suggestions = await provider.suggestions(
          `You are helping a user explore their own tax return data. Generate 3 short follow-up questions the user might want to ask about their finances. Phrase questions in FIRST PERSON (e.g., "Why did my income drop?" not "Why did your income drop?").`,
          messages,
        );

        return Response.json({ suggestions: suggestions.slice(0, 3) });
      } catch (error) {
        console.error("Suggestions error:", error);
        return Response.json({ suggestions: [] });
      }
    },
  },
  "/api/parse": {
    POST: async (req: Request) => {
      const formData = await req.formData();
      const file = formData.get("pdf") as File | null;
      const apiKeyFromForm = formData.get("apiKey") as string | null;

      if (!file) {
        return Response.json({ error: "No PDF file provided" }, { status: 400 });
      }

      // Build provider from form key or stored config
      let provider: LLMProvider | null = null;
      let configToSave: ProviderConfig | null = null;

      if (apiKeyFromForm?.trim()) {
        const trimmedKey = apiKeyFromForm.trim();
        const detected = detectProvider(trimmedKey);
        if (detected) {
          const config: ProviderConfig = { type: detected, apiKey: trimmedKey };
          provider = createProvider(config);
          configToSave = config;
        }
      }
      if (!provider) {
        provider = getProvider();
      }
      if (!provider) {
        return Response.json({ error: "No API key provided" }, { status: 400 });
      }

      try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const taxReturn = await parseTaxReturn(base64, provider);

        // Save key only after successful parse
        if (configToSave) {
          await saveProviderConfig(configToSave);
        }

        await saveReturn(taxReturn);
        return Response.json(taxReturn);
      } catch (error) {
        console.error("Parse error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";

        if (isAuthError(message)) {
          await removeProviderConfig();
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        if (message.includes("prompt is too long") || message.includes("too many tokens")) {
          return Response.json(
            { error: "PDF is too large to process. Try uploading just the main tax forms." },
            { status: 400 },
          );
        }
        if (message.includes("JSON")) {
          return Response.json({ error: "Failed to parse tax return data" }, { status: 422 });
        }
        return Response.json({ error: message }, { status: 500 });
      }
    },
  },
  "/api/models": {
    GET: async (req: Request) => {
      const url = new URL(req.url);
      const baseUrl = url.searchParams.get("baseUrl") || "http://localhost:11434/v1";

      try {
        const response = await fetch(`${baseUrl}/models`);
        if (!response.ok) {
          return Response.json({ error: "Could not reach model server" }, { status: 502 });
        }
        const data = await response.json();
        return Response.json(data);
      } catch {
        return Response.json({ error: "Could not connect to local model server" }, { status: 502 });
      }
    },
  },
};

if (!isProd) {
  routes["/*"] = index;
}

const server = serve({
  port,
  routes,
  fetch: isProd
    ? async (req) => {
        const url = new URL(req.url);
        const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
        const resolvedPath = path.resolve(STATIC_ROOT, `.${pathname}`);

        if (!resolvedPath.startsWith(STATIC_ROOT)) {
          return new Response("Not found", { status: 404 });
        }

        const file = Bun.file(resolvedPath);
        if (await file.exists()) {
          return new Response(file);
        }

        return new Response("Not found", { status: 404 });
      }
    : undefined,
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
