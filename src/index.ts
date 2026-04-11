import { argv, serve } from "bun";
import path from "path";
import { fileURLToPath } from "url";

import index from "./index.html";
import {
  type AIConfig,
  generateChatResponse,
  generateSuggestions,
  getClient,
  isAuthError,
} from "./lib/ai";
import { extractYearFromPdf, parseTaxReturn } from "./lib/parser";
import { parseDocument } from "./lib/parsers";
import {
  type BankStatement,
  normalizeExpenseCategory,
  type Payslip,
  type Transaction,
} from "./lib/schema";
import {
  clearAllData,
  deleteBankStatement,
  deleteExpenseEntry,
  deletePayslip,
  deleteReturn,
  deleteTransaction,
  getApiKey,
  getApiKeys,
  getBankStatements,
  getExpenses,
  getPayslips,
  getReturns,
  getStoredProvider,
  getTransactions,
  removeApiKey,
  saveApiKey,
  saveBankStatement,
  saveExpenseEntry,
  saveProvider,
  saveReturn,
  saveTransaction,
} from "./lib/storage";

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
      const apiKeys = getApiKeys();
      const provider = getStoredProvider();
      const hasKey = Boolean(
        apiKeys.vercel || apiKeys.anthropic || apiKeys.openai || apiKeys.google,
      );
      const isDemo = process.env.DEMO_MODE === "true";
      const isDev = process.env.NODE_ENV !== "production";
      return Response.json({
        hasKey,
        isDemo,
        isDev,
        provider,
        keys: {
          vercel: Boolean(apiKeys.vercel),
          anthropic: Boolean(apiKeys.anthropic),
          openai: Boolean(apiKeys.openai),
          google: Boolean(apiKeys.google),
        },
      });
    },
  },
  "/api/config/key": {
    POST: async (req: Request) => {
      const { apiKey, provider = "vercel" } = await req.json();
      if (!apiKey || typeof apiKey !== "string") {
        return Response.json({ error: "Invalid API key" }, { status: 400 });
      }

      // Validate the key with a minimal API call
      try {
        const client = getClient({ provider, apiKey: apiKey.trim() });
        // Simple validation by creating the client - errors will throw
        await client.languageModel("claude-3-5-haiku-latest");
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (isAuthError(error)) {
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        // Other errors (rate limit, etc.) - key is probably valid
      }

      await saveApiKey(apiKey.trim(), provider);
      await saveProvider(provider);
      return Response.json({ success: true, provider });
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

      const formApiKey = formData.get("apiKey") as string | null;
      const apiKey = formApiKey || getApiKey();
      const provider = getStoredProvider();
      if (!apiKey) {
        return Response.json({ error: "No API key configured" }, { status: 400 });
      }

      try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const year = await extractYearFromPdf(base64, apiKey, provider);
        return Response.json({ year });
      } catch (error) {
        console.error("Year extraction error:", error);
        const message = error instanceof Error ? error.message : "";
        if (isAuthError(message)) {
          await removeApiKey();
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        return Response.json({ year: null });
      }
    },
  },
  "/api/chat": {
    POST: async (req: Request) => {
      const { prompt, history, returns: clientReturns } = await req.json();

      if (!prompt || typeof prompt !== "string") {
        return Response.json({ error: "No prompt provided" }, { status: 400 });
      }

      const apiKey = getApiKey();
      const provider = getStoredProvider();
      if (!apiKey) {
        return Response.json({ error: "No API key configured" }, { status: 400 });
      }

      // Use client-provided returns (for dev sample data) or fall back to stored returns
      const returns =
        clientReturns && Object.keys(clientReturns).length > 0 ? clientReturns : await getReturns();

      try {
        const messages = (history || []).map((msg: { role: string; content: string }) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));
        messages.push({ role: "user", content: prompt });

        const responseText = await generateChatResponse(
          { provider: provider as AIConfig["provider"], apiKey },
          buildChatSystemPrompt(returns),
          messages,
        );

        return Response.json({ response: responseText });
      } catch (error) {
        console.error("Chat error:", error);
        if (isAuthError(error)) {
          await removeApiKey();
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 },
        );
      }
    },
  },
  "/api/suggestions": {
    POST: async (req: Request) => {
      const { history, returns: clientReturns } = await req.json();

      const apiKey = getApiKey();
      const provider = getStoredProvider();
      if (!apiKey) {
        return Response.json({ suggestions: [] });
      }

      const returns =
        clientReturns && Object.keys(clientReturns).length > 0 ? clientReturns : await getReturns();

      try {
        const messages = (history || []).map((msg: { role: string; content: string }) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

        const suggestions = await generateSuggestions(
          { provider: provider as AIConfig["provider"], apiKey },
          `You are helping a user explore their own tax return data. Generate 3 short follow-up questions the user might want to ask about their finances. Phrase questions in FIRST PERSON (e.g., "Why did my income drop?" not "Why did your income drop?").`,
          messages,
        );

        return Response.json({ suggestions });
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

      const apiKey = apiKeyFromForm?.trim() || getApiKey();
      const provider = getStoredProvider();
      if (!apiKey) {
        return Response.json({ error: "No API key provided" }, { status: 400 });
      }

      try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const taxReturn = await parseTaxReturn(base64, apiKey, provider);

        // Save key only after successful parse
        if (apiKeyFromForm?.trim()) {
          await saveApiKey(apiKeyFromForm.trim(), provider);
          await saveProvider(provider);
        }

        await saveReturn(taxReturn);
        return Response.json(taxReturn);
      } catch (error) {
        console.error("Parse error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";

        if (isAuthError(message)) {
          await removeApiKey();
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

  // ============================================
  // EXPENSES API
  // ============================================

  "/api/expenses": {
    GET: async () => {
      return Response.json(await getExpenses());
    },
  },

  "/api/expenses/:year": {
    GET: async (req: Request & { params: { year: string } }) => {
      const year = Number(req.params.year);
      if (isNaN(year)) {
        return Response.json({ error: "Invalid year" }, { status: 400 });
      }
      const expenses = await getExpenses();
      return Response.json(expenses[year] || { year, entries: [] });
    },
  },

  "/api/expenses/entry": {
    POST: async (req: Request) => {
      const entry = await req.json();
      if (!entry.year || !entry.category || !entry.amount) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      // Generate ID and timestamps if not provided
      const now = new Date().toISOString();
      const newEntry = {
        ...entry,
        id: entry.id || crypto.randomUUID(),
        createdAt: entry.createdAt || now,
        updatedAt: now,
      };
      await saveExpenseEntry(newEntry);
      return Response.json(newEntry);
    },
  },

  "/api/expenses/entry/:year/:id": {
    DELETE: async (req: Request & { params: { year: string; id: string } }) => {
      const year = Number(req.params.year);
      if (isNaN(year)) {
        return Response.json({ error: "Invalid year" }, { status: 400 });
      }
      await deleteExpenseEntry(year, req.params.id);
      return Response.json({ success: true });
    },
  },

  // ============================================
  // PAYSLIPS API
  // ============================================

  "/api/payslips": {
    GET: async () => {
      return Response.json(await getPayslips());
    },
  },

  "/api/payslips/:id": {
    DELETE: async (req: Request & { params: { id: string } }) => {
      await deletePayslip(req.params.id);
      return Response.json({ success: true });
    },
  },

  "/api/payslips/upload": {
    POST: async (req: Request) => {
      const formData = await req.formData();
      const file = formData.get("pdf") as File | null;
      const apiKeyFromForm = formData.get("apiKey") as string | null;

      if (!file) {
        return Response.json({ error: "No PDF file provided" }, { status: 400 });
      }

      const apiKey = apiKeyFromForm?.trim() || getApiKey();
      const provider = getStoredProvider();
      if (!apiKey) {
        return Response.json({ error: "No API key configured" }, { status: 400 });
      }

      try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const result = await parseDocument(base64, apiKey, "payslip", provider);

        if (result.type !== "payslip") {
          return Response.json({ error: "Document is not a payslip" }, { status: 400 });
        }

        const payslip = {
          ...result.data,
          id: crypto.randomUUID(),
          sourceFile: file.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Payslip;
      } catch (error) {
        console.error("Payslip parse error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        if (isAuthError(message)) {
          await removeApiKey();
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        return Response.json({ error: message }, { status: 500 });
      }
    },
  },

  // ============================================
  // BANK STATEMENTS API
  // ============================================

  "/api/bank-statements": {
    GET: async () => {
      return Response.json(await getBankStatements());
    },
  },

  "/api/bank-statements/:id": {
    DELETE: async (req: Request & { params: { id: string } }) => {
      await deleteBankStatement(req.params.id);
      return Response.json({ success: true });
    },
  },

  "/api/bank-statements/upload": {
    POST: async (req: Request) => {
      const formData = await req.formData();
      const file = formData.get("pdf") as File | null;
      const apiKeyFromForm = formData.get("apiKey") as string | null;

      if (!file) {
        return Response.json({ error: "No PDF file provided" }, { status: 400 });
      }

      const apiKey = apiKeyFromForm?.trim() || getApiKey();
      const provider = getStoredProvider();
      if (!apiKey) {
        return Response.json({ error: "No API key configured" }, { status: 400 });
      }

      try {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const result = await parseDocument(base64, apiKey, "bank-statement", provider);

        if (result.type !== "bank-statement") {
          return Response.json({ error: "Document is not a bank statement" }, { status: 400 });
        }

        const statement = {
          ...result.data,
          id: crypto.randomUUID(),
          sourceFile: file.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as BankStatement;

        await saveBankStatement(statement);

        // Create transactions from bank statement transactions
        const now = new Date().toISOString();
        const createdTransactions: Transaction[] = [];

        for (const tx of statement.transactions) {
          const transaction: Transaction = {
            id: crypto.randomUUID(),
            date: tx.date,
            amount: Math.abs(tx.amount),
            category:
              tx.type === "credit"
                ? "salary"
                : normalizeExpenseCategory(tx.category || tx.description),
            type: tx.type === "credit" ? "income" : "expense",
            description: tx.description,
            createdAt: now,
            updatedAt: now,
          };
          await saveTransaction(transaction);
          createdTransactions.push(transaction);
        }

        return Response.json({ statement, transactions: createdTransactions });
      } catch (error) {
        console.error("Bank statement parse error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        if (isAuthError(message)) {
          await removeApiKey();
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        return Response.json({ error: message }, { status: 500 });
      }
    },
  },

  // ============================================
  // TRANSACTIONS API
  // ============================================

  "/api/transactions": {
    GET: async () => {
      return Response.json(await getTransactions());
    },
    POST: async (req: Request) => {
      const transaction = await req.json();
      if (!transaction.date || !transaction.amount || !transaction.type || !transaction.category) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      const now = new Date().toISOString();
      const newTransaction: Transaction = {
        id: transaction.id || crypto.randomUUID(),
        date: transaction.date,
        amount: transaction.amount,
        category: transaction.category,
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt || now,
        updatedAt: now,
      };
      await saveTransaction(newTransaction);
      return Response.json(newTransaction);
    },
  },

  "/api/transactions/:id": {
    PUT: async (req: Request & { params: { id: string } }) => {
      const updates = await req.json();
      const transactions = await getTransactions();
      const existing = transactions.find((t) => t.id === req.params.id);
      if (!existing) {
        return Response.json({ error: "Transaction not found" }, { status: 404 });
      }
      const updated: Transaction = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      await saveTransaction(updated);
      return Response.json(updated);
    },
    DELETE: async (req: Request & { params: { id: string } }) => {
      await deleteTransaction(req.params.id);
      return Response.json({ success: true });
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
