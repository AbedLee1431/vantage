import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import { POST as analystPost } from "@/app/api/ai/analyst/route";
import { POST as adAnalyzePost } from "@/app/api/ai/ads/[id]/analyze/route";
import { GET as jobGet } from "@/app/api/jobs/[id]/route";
import { POST as jobsProcessPost } from "@/app/api/jobs/process/route";
import { GET as conversationsGet } from "@/app/api/ai/conversations/route";
import { GET as conversationGet } from "@/app/api/ai/conversations/[id]/route";
import { buildDemoDataset } from "@/server/db/seed-data";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

vi.mock("@/server/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

const mockAuth = auth as unknown as {
  mockResolvedValue: (
    session: { user: { id: string; email: string; name: string | null }; expires: string } | null,
  ) => void;
};

function sessionFor(user: { id: string; email: string; name: string | null }) {
  mockAuth.mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

function postJson(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readSSE(
  res: Response,
): Promise<{ text: string; done?: Record<string, unknown>; error?: string }> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let done: Record<string, unknown> | undefined;
  let error: string | undefined;
  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part
        .trim()
        .split("\n")
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const event = JSON.parse(line.slice(5).trim()) as {
        token?: string;
        done?: boolean;
        error?: string;
        conversationId?: string;
        messageId?: string;
        refs?: unknown[];
      };
      if (typeof event.token === "string") text += event.token;
      if (event.done) done = event as Record<string, unknown>;
      if (typeof event.error === "string") error = event.error;
    }
  }
  return { text, done, error };
}

describe("analyst API (streaming, persisted, scoped)", () => {
  it("rejects unauthenticated and invalid requests", async () => {
    mockAuth.mockResolvedValue(null);
    const unauth = await analystPost(postJson("http://x/api/ai/analyst", { message: "hi" }));
    expect(unauth.status).toBe(401);

    const { user, organization } = await createTestOrg("AnalystAuth");
    try {
      sessionFor(user);
      const bad = await analystPost(postJson("http://x/api/ai/analyst", { message: "" }));
      expect(bad.status).toBe(400);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("answers from tools, streams, persists, and cites records", async () => {
    const { user, organization } = await seededOrg("AnalystFlow");
    try {
      sessionFor(user);
      const res = await analystPost(
        postJson("http://x/api/ai/analyst", {
          message: "Summarize the biggest customer complaints",
        }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const { text, done, error } = await readSSE(res);
      expect(error).toBeUndefined();
      expect(text.length).toBeGreaterThan(0);
      expect(text).toMatch(/Demo AI/i);
      expect(done?.conversationId).toBeTruthy();

      const convoId = done!.conversationId as string;
      const stored = await prisma.aiConversation.findUnique({
        where: { id: convoId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      expect(stored?.organizationId).toBe(organization.id);
      expect(stored?.messages).toHaveLength(2);
      expect(stored?.messages[0]?.role).toBe("user");
      const assistant = stored?.messages[1];
      expect(assistant?.role).toBe("assistant");
      expect(assistant?.provenance).toBe("demo");
      const toolCalls = assistant?.toolCalls as { tool: string }[] | null;
      expect(Array.isArray(toolCalls) && toolCalls.length).toBeGreaterThan(0);

      // conversations list + scoped detail
      const listRes = await conversationsGet();
      const list = (await listRes.json()) as { conversations: { id: string }[] };
      expect(list.conversations.some((c) => c.id === convoId)).toBe(true);
      const detailRes = await conversationGet(
        new NextRequest(`http://x/api/ai/conversations/${convoId}`),
        {
          params: Promise.resolve({ id: convoId }),
        },
      );
      expect(detailRes.status).toBe(200);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("says unavailable when the workspace is empty", async () => {
    const { user, organization } = await createTestOrg("AnalystEmpty");
    try {
      sessionFor(user);
      const res = await analystPost(
        postJson("http://x/api/ai/analyst", { message: "Any complaints?" }),
      );
      const { text } = await readSSE(res);
      expect(text).toMatch(/no data/i);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("blocks cross-org conversation and job access", async () => {
    const a = await createTestOrg("AnalystX A");
    const b = await createTestOrg("AnalystX B");
    await buildDemoDataset(a.organization.id);
    try {
      sessionFor(a.user);
      const res = await analystPost(postJson("http://x/api/ai/analyst", { message: "Hi" }));
      const { done } = await readSSE(res);
      const convoId = done!.conversationId as string;

      sessionFor(b.user);
      const cross = await conversationGet(
        new NextRequest(`http://x/api/ai/conversations/${convoId}`),
        {
          params: Promise.resolve({ id: convoId }),
        },
      );
      expect(cross.status).toBe(404);
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("analysis + jobs API", () => {
  it("enqueues on miss, processes, polls to done, caches repeats", async () => {
    const { user, organization } = await createTestOrg("ApiJobs");
    await buildDemoDataset(organization.id);
    try {
      sessionFor(user);
      const ad = await prisma.ad.findFirst({ where: { organizationId: organization.id } });

      const req1 = await adAnalyzePost(postJson("http://x/api/ai/ads/x/analyze", {}), {
        params: Promise.resolve({ id: ad!.id }),
      });
      expect(req1.status).toBe(202);
      const { jobId } = (await req1.json()) as { jobId: string };
      expect(jobId).toBeTruthy();

      const run = await jobsProcessPost(postJson("http://x/api/jobs/process", {}));
      expect(run.status).toBe(200);

      const poll = await jobGet(new NextRequest(`http://x/api/jobs/${jobId}`), {
        params: Promise.resolve({ id: jobId }),
      });
      expect(poll.status).toBe(200);
      const jobBody = (await poll.json()) as {
        job: { status: string };
        analysis: { id: string };
      };
      expect(jobBody.job.status).toBe("done");
      expect(jobBody.analysis.id).toBeTruthy();

      // repeat → cache hit, no new job
      const req2 = await adAnalyzePost(postJson("http://x/api/ai/ads/x/analyze", {}), {
        params: Promise.resolve({ id: ad!.id }),
      });
      expect(req2.status).toBe(200);
      const cached = (await req2.json()) as { cached: boolean; analysisId: string };
      expect(cached.cached).toBe(true);
      expect(cached.analysisId).toBe(jobBody.analysis.id);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("returns 404 for missing/cross-org targets and jobs", async () => {
    const a = await createTestOrg("Api404 A");
    const b = await createTestOrg("Api404 B");
    await buildDemoDataset(a.organization.id);
    await buildDemoDataset(b.organization.id);
    try {
      sessionFor(a.user);
      const missing = await adAnalyzePost(postJson("http://x/api/ai/ads/x/analyze", {}), {
        params: Promise.resolve({ id: "c".repeat(25) }),
      });
      expect(missing.status).toBe(404);

      const bAd = await prisma.ad.findFirst({ where: { organizationId: b.organization.id } });
      const cross = await adAnalyzePost(postJson("http://x/api/ai/ads/x/analyze", {}), {
        params: Promise.resolve({ id: bAd!.id }),
      });
      expect(cross.status).toBe(404);

      const noJob = await jobGet(new NextRequest("http://x/api/jobs/ccc"), {
        params: Promise.resolve({ id: "c".repeat(25) }),
      });
      expect(noJob.status).toBe(404);
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

async function seededOrg(name: string) {
  const created = await createTestOrg(name);
  await buildDemoDataset(created.organization.id);
  return created;
}
