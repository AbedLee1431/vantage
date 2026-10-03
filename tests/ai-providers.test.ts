import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AIConfigurationError,
  AIParseError,
  DemoAIProvider,
  OpenAICompatibleProvider,
  extractJson,
  getAIProvider,
  getAIStatus,
} from "@/server/ai/providers";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_PROVIDER;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  delete process.env.AI_BASE_URL;
});

function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

describe("provider factory + status", () => {
  it("defaults to Demo with no configuration", () => {
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(DemoAIProvider);
    expect(provider.name).toBe("demo");
    expect(getAIStatus().active).toBe("demo");
  });

  it("throws (not silent demo) when live is requested but misconfigured", () => {
    process.env.AI_PROVIDER = "openai-compatible";
    expect(() => getAIProvider()).toThrow(AIConfigurationError);
    expect(getAIStatus().active).toBe("misconfigured");
  });

  it("constructs live provider from env without leaking the key", () => {
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.AI_API_KEY = "sk-test-secret";
    process.env.AI_MODEL = "test-model";
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    expect(provider.model).toBe("test-model");
    const status = getAIStatus();
    expect(status.active).toBe("live");
    expect(JSON.stringify(status)).not.toContain("sk-test-secret");
  });
});

describe("DemoAIProvider", () => {
  const demo = new DemoAIProvider();

  it("builds structured, labeled ad analysis from evidence only", async () => {
    const evidence = {
      kind: "ad",
      ad: {
        id: "ad1",
        title: "Winter sale now",
        primaryText: "Warm jackets on sale now. Limited stock.",
        headline: null,
        cta: "Shop Now",
        platform: "Meta",
        format: "image",
        status: "active",
        durationDays: 5,
        firstSeen: new Date(),
        lastSeen: new Date(),
        destinationUrl: null,
      },
      store: { id: "s1", name: "Nordwind", domain: "n.example", category: "Outdoor" },
      advertiser: { id: "a1", name: "Nordwind", platform: "Meta" },
      storeAdCount: 3,
    };
    const { json } = await demo.analyze({ system: "x", user: "{}", evidence });
    const result = json as { sections: { key: string }[]; angle: string; disclaimers: string[] };
    expect(result.sections.map((s) => s.key)).toEqual([
      "hook",
      "problem",
      "promise",
      "offer",
      "structure",
      "cta",
      "audience",
      "angle",
    ]);
    // price + urgency keywords present
    expect(["price", "urgency"]).toContain(result.angle);
    expect(result.disclaimers.join(" ")).toMatch(/Demo AI/i);
  });

  it("rejects unknown kinds and missing evidence", async () => {
    await expect(demo.analyze({ system: "x", user: "{}" })).rejects.toThrow(AIParseError);
    await expect(
      demo.analyze({ system: "x", user: "{}", evidence: { kind: "spaceship" } }),
    ).rejects.toThrow(/does not support/);
  });

  it("answers from tool results only, labels demo, states when empty", async () => {
    const callTool = vi.fn(async (name: string) => {
      if (name === "searchProducts") return { total: 0, items: [] };
      if (name === "searchStores") return { total: 0, items: [] };
      if (name === "searchAds") return { total: 0, items: [] };
      if (name === "getReviews") return { total: 0, items: [] };
      if (name === "getTrends") return { summary: [], categories: [] };
      if (name === "getRecentChanges") return [];
      return { total: 0, items: [] };
    });
    const { text, toolCalls, refs } = await demo.chat({
      messages: [{ role: "user", content: "Summarize complaints" }],
      tools: [],
      callTool,
    });
    expect(text).toMatch(/no data/i);
    expect(text).toMatch(/Demo AI/i);
    expect(toolCalls.length).toBeGreaterThan(0);
    expect(refs).toEqual([]);
    // tools were actually called (evidence-first, not invented)
    expect(callTool).toHaveBeenCalledWith("getReviews", expect.anything());
  });

  it("streams tokens when onToken is provided", async () => {
    const tokens: string[] = [];
    const callTool = vi.fn(async () => ({ total: 1, items: [{ id: "p1", name: "X" }] }));
    const { text } = await demo.chat({
      messages: [{ role: "user", content: "What products exist?" }],
      tools: [],
      callTool,
      onToken: (t) => tokens.push(t),
    });
    expect(tokens.join("")).toBe(text);
    expect(text.length).toBeGreaterThan(0);
  });
});

describe("OpenAICompatibleProvider (mocked fetch)", () => {
  const opts = { apiKey: "sk-test", baseUrl: "https://api.test/v1", model: "m" };

  it("sends a chat completion and returns text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ choices: [{ message: { content: "Hello from model." } }] }),
      ),
    );
    const provider = new OpenAICompatibleProvider(opts);
    const result = await provider.chat({
      messages: [{ role: "user", content: "Hi" }],
      tools: [],
      callTool: async () => ({}),
    });
    expect(result.text).toBe("Hello from model.");
    expect(result.toolCalls).toEqual([]);
  });

  it("runs the tool loop through the app dispatcher", async () => {
    const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { messages: { content: string }[] };
      const last = body.messages[body.messages.length - 1]?.content ?? "";
      if (last.includes("Tool searchProducts returned")) {
        return Response.json({ choices: [{ message: { content: "Found 2 products." } }] });
      }
      return Response.json({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: "c1", function: { name: "searchProducts", arguments: '{"q":"x"}' } },
              ],
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider(opts);
    const seen: string[] = [];
    const result = await provider.chat({
      messages: [{ role: "user", content: "Find x" }],
      tools: [
        {
          name: "searchProducts",
          description: "s",
          parameters: { type: "object", properties: {} },
        },
      ],
      callTool: async (name, args) => {
        seen.push(name);
        expect(args).toEqual({ q: "x" });
        return { total: 2, items: [] };
      },
    });
    expect(result.text).toBe("Found 2 products.");
    expect(seen).toEqual(["searchProducts"]);
    expect(result.toolCalls).toHaveLength(1);
  });

  it("streams deltas including reassembled tool calls", async () => {
    const toolChunks = [
      `data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"getProduct","arguments":"{\\"id\\""}}]}}]}\n\n`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"p1\\"}"}}]}}]}\n\n`,
      `data: [DONE]\n\n`,
    ];
    const answerChunks = [
      `data: {"choices":[{"delta":{"content":"Done."}}]}\n\n`,
      `data: [DONE]\n\n`,
    ];
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        return sseResponse(calls === 1 ? toolChunks : answerChunks);
      }),
    );
    const provider = new OpenAICompatibleProvider(opts);
    const tokens: string[] = [];
    const result = await provider.chat({
      messages: [{ role: "user", content: "Hi" }],
      tools: [
        { name: "getProduct", description: "g", parameters: { type: "object", properties: {} } },
      ],
      callTool: async () => ({ found: true }),
      onToken: (t) => tokens.push(t),
    });
    expect(tokens.join("")).toBe("HiDone.");
    expect(result.text).toBe("Done.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({ tool: "getProduct" });
  });

  it("maps 401 to configuration error (no retry) and 429 to retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 401 })),
    );
    const provider = new OpenAICompatibleProvider(opts);
    await expect(
      provider.chat({
        messages: [{ role: "user", content: "x" }],
        tools: [],
        callTool: async () => ({}),
      }),
    ).rejects.toThrow(/API key/);

    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        if (calls === 1) return new Response("busy", { status: 429 });
        return Response.json({ choices: [{ message: { content: "recovered" } }] });
      }),
    );
    const recovered = await provider.chat({
      messages: [{ role: "user", content: "x" }],
      tools: [],
      callTool: async () => ({}),
    });
    expect(recovered.text).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("analyze returns extracted JSON; unparseable output fails loudly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ choices: [{ message: { content: 'Here is {"angle":"price"} done' } }] }),
      ),
    );
    const provider = new OpenAICompatibleProvider(opts);
    const ok = await provider.analyze({ system: "s", user: "u" });
    expect(ok.json).toEqual({ angle: "price" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ choices: [{ message: { content: "no json here" } }] })),
    );
    await expect(provider.analyze({ system: "s", user: "u" })).rejects.toThrow(/no JSON object/);
  });
});

describe("extractJson", () => {
  it("finds objects inside prose and rejects non-JSON", () => {
    expect(extractJson('pre {"a":1} post')).toEqual({ a: 1 });
    expect(() => extractJson("nothing here")).toThrow();
  });
});
