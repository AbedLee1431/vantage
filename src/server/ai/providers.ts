import type {
  AIAnalyzeRequest,
  AIAnalyzeResult,
  AIChatRequest,
  AIChatResult,
  AIProvider,
  ChatMessage,
  ProviderStatus,
  ToolCallRecord,
} from "@/lib/ai";
import {
  buildDemoAdAnalysis,
  buildDemoChatAnswer,
  buildDemoCompetitorAnalysis,
} from "./demo-content";

/**
 * AI providers (ADR-005). Demo works with zero configuration; the
 * OpenAI-compatible client covers OpenAI, OpenRouter, and local servers via
 * AI_BASE_URL. Keys never leave the server (this module is server-only).
 */

export class AIError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
  }
}

export class AIConfigurationError extends AIError {
  constructor(message: string) {
    super("ai_configuration", message, false);
  }
}

export class AIProviderError extends AIError {
  readonly status?: number;
  constructor(message: string, status?: number, retryable = false) {
    super("ai_provider", message, retryable);
    this.status = status;
  }
}

export class AITimeoutError extends AIError {
  constructor(message = "AI provider timed out") {
    super("ai_timeout", message, true);
  }
}

export class AIParseError extends AIError {
  constructor(message = "AI provider returned unusable output") {
    super("ai_parse", message, false);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FetchOptions = {
  timeoutMs: number;
  maxRetries: number;
};

/** POST JSON with timeout + retry on 429/5xx/network (never on 400/401). */
export async function postJson(
  url: string,
  apiKey: string,
  body: unknown,
  opts: FetchOptions,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.status === 401 || response.status === 403) {
        throw new AIProviderError("AI provider rejected the API key.", response.status, false);
      }
      if (response.status === 400) {
        const text = await response.text().catch(() => "");
        throw new AIProviderError(
          `AI provider rejected the request (${text.slice(0, 200) || "bad request"}).`,
          400,
          false,
        );
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new AIProviderError(
          `AI provider unavailable (HTTP ${response.status}).`,
          response.status,
          true,
        );
        if (attempt < opts.maxRetries) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw lastError;
      }
      if (!response.ok) {
        throw new AIProviderError(
          `AI provider error (HTTP ${response.status}).`,
          response.status,
          false,
        );
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof AIError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AITimeoutError();
      }
      lastError = new AIProviderError(
        `AI provider network error (${error instanceof Error ? error.message : "unknown"}).`,
        undefined,
        true,
      );
      if (attempt < opts.maxRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError instanceof Error ? lastError : new AIProviderError("AI provider failed.");
}

// ── Demo provider ───────────────────────────────────────────────────────────

type DemoEvidence =
  | {
      kind: "ad";
      ad: Parameters<typeof buildDemoAdAnalysis>[0]["ad"];
      store: Parameters<typeof buildDemoAdAnalysis>[0]["store"];
      advertiser: Parameters<typeof buildDemoAdAnalysis>[0]["advertiser"];
      storeAdCount: number;
    }
  | { kind: "competitor"; [key: string]: unknown };

export class DemoAIProvider implements AIProvider {
  readonly name = "demo";
  readonly model = "demo-v1";

  async analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResult> {
    const evidence = (request as { evidence?: DemoEvidence }).evidence;
    if (!evidence || typeof evidence !== "object" || !("kind" in evidence)) {
      throw new AIParseError("Demo analysis requires structured evidence.");
    }
    if (evidence.kind === "ad") {
      const result = buildDemoAdAnalysis(evidence as Parameters<typeof buildDemoAdAnalysis>[0]);
      return { text: JSON.stringify(result), json: result };
    }
    if (evidence.kind === "competitor") {
      const result = buildDemoCompetitorAnalysis(
        evidence as unknown as Parameters<typeof buildDemoCompetitorAnalysis>[0],
      );
      return { text: JSON.stringify(result), json: result };
    }
    throw new AIParseError(
      `Demo analysis does not support kind "${String((evidence as { kind?: unknown }).kind)}".`,
    );
  }

  async chat(request: AIChatRequest): Promise<AIChatResult> {
    const userMessage = [...request.messages].reverse().find((m) => m.role === "user");
    const question = userMessage?.content ?? "";
    const toolCalls: ToolCallRecord[] = [];

    const call = async (tool: string, args: unknown): Promise<unknown> => {
      try {
        const result = await request.callTool(tool, args);
        toolCalls.push({ tool, args, result: truncate(result) });
        return result;
      } catch {
        toolCalls.push({ tool, args, result: { error: "unavailable" } });
        return { items: [], total: 0, error: "unavailable" };
      }
    };

    // Evidence bundle: broad, bounded, deterministic. Everything the answer
    // states comes from these calls — never from generation.
    const [products, stores, ads, reviews, trends, changes, opportunities] = await Promise.all([
      call("searchProducts", { q: "", pageSize: 10 }),
      call("searchStores", { q: "", pageSize: 10 }),
      call("searchAds", { q: "", pageSize: 10 }),
      call("getReviews", { limit: 20 }),
      call("getTrends", {}),
      call("getRecentChanges", { limit: 10 }),
      call("listOpportunities", {}),
    ]);

    const bundle = {
      products: rowsOf(products, "items").map((p) => ({
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        category: String(p.category ?? ""),
        price: Number(p.price ?? 0),
        storeName: String(p.storeName ?? (p.store as { name?: unknown } | undefined)?.name ?? ""),
      })),
      stores: rowsOf(stores, "items").map((s) => ({
        id: String(s.id ?? ""),
        name: String(s.name ?? ""),
        domain: String(s.domain ?? ""),
        category: String(s.category ?? ""),
        productCount: Number(s.productCount ?? 0),
      })),
      ads: rowsOf(ads, "items").map((a) => ({
        id: String(a.id ?? ""),
        title: String(a.title ?? ""),
        platform: String(a.platform ?? ""),
        format: String(a.format ?? ""),
        status: String(a.status ?? ""),
        advertiserName: String(
          a.advertiserName ?? (a.advertiser as { name?: unknown } | undefined)?.name ?? "",
        ),
      })),
      reviews: rowsOf(reviews, "items").map((r) => ({
        id: String(r.id ?? ""),
        rating: Number(r.rating ?? 0),
        title: r.title == null ? null : String(r.title),
        body: String(r.body ?? ""),
        productName: r.productName == null ? null : String(r.productName),
      })),
      changes: rowsOf(changes, "items").map((c) => ({
        type: String(c.type ?? ""),
        summary: String(c.summary ?? ""),
      })),
      trends: Array.isArray((trends as { summary?: unknown }).summary)
        ? (trends as { summary: unknown[] }).summary.map(String)
        : [],
      opportunities: Array.isArray(opportunities)
        ? (opportunities as Record<string, unknown>[]).slice(0, 5).map((o) => ({
            id: String(o.id ?? ""),
            title: String(o.title ?? ""),
            confidence: String(o.confidence ?? "low"),
          }))
        : [],
      counts: {
        products: Number((products as { total?: unknown }).total ?? 0),
        stores: Number((stores as { total?: unknown }).total ?? 0),
        ads: Number((ads as { total?: unknown }).total ?? 0),
        reviews: Number((reviews as { total?: unknown }).total ?? 0),
      },
    };

    const { text, refs } = buildDemoChatAnswer(question, bundle);
    const fullText = text;
    if (request.onToken) {
      // Stream word-by-word (no artificial delay); caller forwards to the client.
      for (const chunk of fullText.match(/[^ ]+ +|[^ ]+$/g) ?? [fullText]) {
        request.onToken(chunk);
      }
    }
    return { text: fullText, toolCalls, refs };
  }
}

function truncate(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 3);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.items)) return { ...obj, items: obj.items.slice(0, 3) };
    const entries = Object.entries(obj).slice(0, 8);
    return Object.fromEntries(entries);
  }
  return value;
}

function rowsOf(value: unknown, key: string): Record<string, unknown>[] {
  if (value && typeof value === "object") {
    const arr = (value as Record<string, unknown>)[key];
    if (Array.isArray(arr)) return arr as Record<string, unknown>[];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }
  return [];
}

// ── OpenAI-compatible provider ──────────────────────────────────────────────

export type OpenAICompatibleOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  maxTokens?: number;
};

type OpenAIToolCall = { id: string; name: string; args: unknown };

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxTokens: number;

  constructor(opts: OpenAICompatibleOptions) {
    if (!opts.apiKey) throw new AIConfigurationError("AI_API_KEY is not configured.");
    if (!opts.model) throw new AIConfigurationError("AI_MODEL is not configured.");
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.model = opts.model;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.maxTokens = opts.maxTokens ?? 2000;
  }

  private toOpenAITools(tools: AIChatRequest["tools"]): unknown[] {
    return tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  private toOpenAIMessages(messages: ChatMessage[]): { role: string; content: string }[] {
    return messages
      .filter((m) => m.role !== "tool")
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async chat(request: AIChatRequest): Promise<AIChatResult> {
    const maxRounds = request.maxRounds ?? 5;
    const messages = this.toOpenAIMessages(request.messages);
    const tools = this.toOpenAITools(request.tools);
    const toolCalls: ToolCallRecord[] = [];

    for (let round = 0; round < maxRounds; round++) {
      const response = await postJson(
        `${this.baseUrl}/chat/completions`,
        this.apiKey,
        {
          model: this.model,
          messages,
          ...(tools.length > 0 ? { tools } : {}),
          max_tokens: this.maxTokens,
          stream: !!request.onToken,
        },
        { timeoutMs: this.timeoutMs, maxRetries: 2 },
      );

      if (request.onToken) {
        const streamed = await this.readStream(response, request.onToken);
        if (streamed.toolCalls.length === 0) {
          return { text: streamed.text, toolCalls };
        }
        for (const call of streamed.toolCalls) {
          const result = await this.safeCallTool(request, call.name, call.args);
          toolCalls.push({ tool: call.name, args: call.args, result });
          messages.push({ role: "assistant", content: "" });
          // Tool results re-enter as context for the next round.
          messages.push({
            role: "user",
            content: `Tool ${call.name} returned: ${JSON.stringify(result)}`,
          });
        }
        messages.push({ role: "assistant", content: streamed.text });
        continue;
      }

      const data = (await response.json()) as {
        choices?: {
          message?: {
            content?: string | null;
            tool_calls?: { id: string; function: { name: string; arguments: string } }[];
          };
        }[];
      };
      const message = data.choices?.[0]?.message;
      if (!message) throw new AIParseError("AI provider returned no message.");
      const calls: OpenAIToolCall[] = (message.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: safeJsonParse(tc.function.arguments),
      }));
      if (calls.length === 0) {
        return { text: message.content ?? "", toolCalls };
      }
      for (const call of calls) {
        const result = await this.safeCallTool(request, call.name, call.args);
        toolCalls.push({ tool: call.name, args: call.args, result });
        messages.push({ role: "assistant", content: message.content ?? "" });
        messages.push({
          role: "user",
          content: `Tool ${call.name} returned: ${JSON.stringify(result)}`,
        });
      }
    }
    throw new AIProviderError("AI provider exceeded the tool-call budget without answering.");
  }

  /** Tool failures become structured feedback (bounded by maxRounds), never a crash. */
  private async safeCallTool(
    request: AIChatRequest,
    name: string,
    args: unknown,
  ): Promise<unknown> {
    try {
      return truncate(await request.callTool(name, args));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[ai] tool ${name} failed:`, message);
      return { error: message };
    }
  }

  private async readStream(
    response: Response,
    onToken: (token: string) => void,
  ): Promise<{ text: string; toolCalls: OpenAIToolCall[] }> {
    const reader = response.body?.getReader();
    if (!reader) throw new AIParseError("AI provider stream unreadable.");
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    const pending = new Map<number, { id: string; name: string; args: string }>();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part
          .trim()
          .split("\n")
          .find((l) => l.startsWith("data:"));
        if (!line) continue;
        const payload = line.slice("data:".length).trim();
        if (payload === "[DONE]") continue;
        let json: {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: {
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }[];
            };
          }[];
        };
        try {
          json = JSON.parse(payload) as typeof json;
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (typeof delta.content === "string" && delta.content) {
          text += delta.content;
          onToken(delta.content);
        }
        for (const tc of delta.tool_calls ?? []) {
          const entry = pending.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.args += tc.function.arguments;
          pending.set(tc.index, entry);
        }
      }
    }
    const toolCalls: OpenAIToolCall[] = [...pending.values()]
      .filter((p) => p.name)
      .map((p) => ({ id: p.id, name: p.name, args: safeJsonParse(p.args) }));
    return { text, toolCalls };
  }

  async analyze(request: AIAnalyzeRequest): Promise<AIAnalyzeResult> {
    const response = await postJson(
      `${this.baseUrl}/chat/completions`,
      this.apiKey,
      {
        model: this.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        max_tokens: this.maxTokens,
      },
      { timeoutMs: this.timeoutMs, maxRetries: 2 },
    );
    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new AIParseError("AI provider returned empty output.");
    return { text, json: extractJson(text) };
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { _raw: text.slice(0, 2000) };
  }
}

/** Extract the first {...} JSON object from model prose (no json-mode dependency). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AIParseError("AI provider output contained no JSON object.");
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    throw new AIParseError("AI provider output was not valid JSON.");
  }
}

// ── Factory + status ────────────────────────────────────────────────────────

export function getAIProvider(): AIProvider {
  const configured = (process.env.AI_PROVIDER ?? "demo").toLowerCase();
  if (configured === "openai-compatible") {
    const apiKey = process.env.AI_API_KEY ?? "";
    const model = process.env.AI_MODEL ?? "";
    if (!apiKey || !model) {
      throw new AIConfigurationError(
        "AI_PROVIDER is openai-compatible but AI_API_KEY or AI_MODEL is missing.",
      );
    }
    return new OpenAICompatibleProvider({
      apiKey,
      baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
      model,
      timeoutMs: process.env.AI_TIMEOUT_MS ? Number(process.env.AI_TIMEOUT_MS) : undefined,
      maxTokens: process.env.AI_MAX_TOKENS ? Number(process.env.AI_MAX_TOKENS) : undefined,
    });
  }
  return new DemoAIProvider();
}

export function getAIStatus(): ProviderStatus {
  try {
    const provider = getAIProvider();
    if (provider instanceof DemoAIProvider) {
      return {
        active: "demo",
        provider: "demo",
        model: provider.model,
        message:
          "Demo AI mode — deterministic, labeled output. Set AI_API_KEY + AI_MODEL for live analysis.",
      };
    }
    return {
      active: "live",
      provider: provider.name,
      model: provider.model,
      message: `Live analysis via ${provider.model}. Usage may incur provider costs.`,
    };
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return { active: "misconfigured", message: error.message };
    }
    throw error;
  }
}
