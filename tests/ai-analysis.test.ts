import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/client";
import type { AIProvider } from "@/lib/ai";
import { getAiUsage } from "@/server/ai/usage";
import { createJob } from "@/server/db/jobs";
import { handleAdAnalysis, handleCompetitorAnalysis, promptHash } from "@/server/jobs/handlers";
import { processJob, processPendingJobs } from "@/server/jobs/runner";
import { DemoAIProvider } from "@/server/ai/providers";
import { buildDemoDataset } from "@/server/db/seed-data";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

// Server modules import @/server/auth for session flows this file never calls —
// stub it so the real next-auth package is not loaded (vitest ESM friction).
vi.mock("@/server/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

const demo = new DemoAIProvider();

async function seededOrg(name: string) {
  const { user, organization } = await createTestOrg(name);
  await buildDemoDataset(organization.id);
  return { user, organization };
}

describe("analysis handlers (evidence → validate → persist)", () => {
  it("analyzes an ad with labeled sections, persists once, caches repeats", async () => {
    const { user, organization } = await seededOrg("Analysis A");
    try {
      const ad = await prisma.ad.findFirst({ where: { organizationId: organization.id } });
      const first = await handleAdAnalysis(organization.id, ad!.id, demo);
      expect(first.cached).toBe(false);
      const row = await prisma.aiAnalysis.findUnique({ where: { id: first.analysisId } });
      expect(row?.kind).toBe("ad");
      expect(row?.provenance).toBe("demo");
      expect(row?.provider).toBe("demo");
      const result = row?.result as { sections: { key: string }[]; angle: string };
      expect(result.sections.map((s) => s.key)).toContain("hook");
      expect(result.sections.every((s) => typeof s === "object")).toBe(true);
      const evidence = row?.evidence as { type: string; id: string }[];
      expect(evidence.length).toBeGreaterThan(0);

      const second = await handleAdAnalysis(organization.id, ad!.id, demo);
      expect(second.cached).toBe(true);
      expect(second.analysisId).toBe(first.analysisId);
      expect(
        await prisma.aiAnalysis.count({ where: { organizationId: organization.id, kind: "ad" } }),
      ).toBe(1);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("analyzes a competitor into 11 evidence-tagged sections", async () => {
    const { user, organization } = await seededOrg("Analysis B");
    try {
      const store = await prisma.store.findFirst({ where: { organizationId: organization.id } });
      const { analysisId } = await handleCompetitorAnalysis(organization.id, store!.id, demo);
      const row = await prisma.aiAnalysis.findUnique({ where: { id: analysisId } });
      const result = row?.result as { sections: { key: string; observed: string[] }[] };
      expect(result.sections).toHaveLength(11);
      expect(result.sections.map((s) => s.key)).toContain("opportunities");
      expect(row?.provenance).toBe("demo");
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("drops unverifiable citations with a disclaimer (R4)", async () => {
    const stub: AIProvider = {
      name: "stub",
      model: "stub-v1",
      async chat() {
        return { text: "", toolCalls: [] };
      },
      async analyze() {
        return {
          text: "{}",
          json: {
            sections: [
              {
                key: "hook",
                title: "Hook",
                observed: ["x"],
                calculated: [],
                interpretation: "y",
                confidence: "low",
              },
            ],
            angle: "price",
            angleEvidence: [],
            disclaimers: [],
            citations: ["does-not-exist-123"],
          },
        };
      },
    };
    const { user, organization } = await seededOrg("Citations");
    try {
      const ad = await prisma.ad.findFirst({ where: { organizationId: organization.id } });
      const { analysisId } = await handleAdAnalysis(organization.id, ad!.id, stub);
      const row = await prisma.aiAnalysis.findUnique({ where: { id: analysisId } });
      const evidence = row?.evidence as { id: string }[];
      expect(evidence.some((e) => e.id === "does-not-exist-123")).toBe(false);
      const result = row?.result as { disclaimers: string[] };
      expect(result.disclaimers.join(" ")).toMatch(/could not be verified/);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("promptHash scopes cache by data, provider, and prompt version", async () => {
    const h1 = promptHash("ad", "a", new Date("2026-01-01T00:00:00Z"), demo);
    const h2 = promptHash("ad", "a", new Date("2026-01-01T00:00:00Z"), demo);
    expect(h1).toBe(h2);
    const stub: AIProvider = {
      name: "other",
      model: "m",
      async chat() {
        return { text: "", toolCalls: [] };
      },
      async analyze() {
        return { text: "", json: {} };
      },
    };
    expect(promptHash("ad", "a", new Date("2026-01-01T00:00:00Z"), stub)).not.toBe(h1);
    expect(promptHash("ad", "a", new Date("2026-01-02T00:00:00Z"), demo)).not.toBe(h1);
  });
});

describe("job runner", () => {
  it("processes queued jobs to done with linked analyses", async () => {
    const { user, organization } = await seededOrg("Jobs A");
    try {
      const ad = await prisma.ad.findFirst({ where: { organizationId: organization.id } });
      const job = await createJob(organization.id, "ad_analysis", { adId: ad!.id });
      const outcome = await processJob(job.id, organization.id);
      expect(outcome.status).toBe("done");
      if (outcome.status !== "done") throw new Error("unreachable");
      const stored = await prisma.job.findUnique({ where: { id: job.id } });
      expect(stored?.status).toBe("done");
      expect(stored?.resultId).toBe(outcome.analysisId);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("records failures without leaking internals", async () => {
    const { user, organization } = await seededOrg("Jobs B");
    try {
      // Unknown ad id → handler throws "Ad not found." → job failed.
      const job = await createJob(organization.id, "ad_analysis", { adId: "c".repeat(25) });
      const outcome = await processJob(job.id, organization.id);
      expect(outcome.status).toBe("failed");
      const stored = await prisma.job.findUnique({ where: { id: job.id } });
      expect(stored?.status).toBe("failed");
      expect(stored?.error).toMatch(/not found/i);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("processes pending batches and never double-runs", async () => {
    const { user, organization } = await seededOrg("Jobs C");
    try {
      const ads = await prisma.ad.findMany({ where: { organizationId: organization.id }, take: 2 });
      for (const ad of ads) {
        await createJob(organization.id, "ad_analysis", { adId: ad.id });
      }
      const batch = await processPendingJobs(organization.id, 5);
      expect(batch.processed).toBe(2);
      expect(batch.succeeded).toBe(2);
      const again = await processPendingJobs(organization.id, 5);
      expect(again.processed).toBe(0);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("usage tracking (derived, informational)", () => {
  it("counts analyses and messages for the current month", async () => {
    const { user, organization } = await seededOrg("Usage");
    try {
      const before = await getAiUsage(organization.id);
      expect(before.analysesThisMonth).toBe(0);
      const ad = await prisma.ad.findFirst({ where: { organizationId: organization.id } });
      await handleAdAnalysis(organization.id, ad!.id, demo);
      const convo = await prisma.aiConversation.create({
        data: { organizationId: organization.id, title: "t" },
      });
      await prisma.aiMessage.create({
        data: {
          conversationId: convo.id,
          organizationId: organization.id,
          role: "user",
          content: "hi",
          provenance: "user",
        },
      });
      const after = await getAiUsage(organization.id);
      expect(after.analysesThisMonth).toBe(1);
      expect(after.chatMessagesThisMonth).toBe(1);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});
