import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import type { AIProvider } from "@/lib/ai";
import { DemoAIProvider } from "@/server/ai/providers";
import { handleOpportunityAnalysis } from "@/server/jobs/handlers";
import {
  archiveOpportunityAction,
  restoreOpportunityAction,
} from "@/modules/opportunities/actions";
import { getOpportunity, listOpportunities } from "@/modules/opportunities/queries";
import { buildDemoDataset } from "@/server/db/seed-data";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

const demo = new DemoAIProvider();

describe("opportunity analysis (hedged, evidence-linked)", () => {
  it("generates grounded opportunities and dedupes reruns", async () => {
    const { user, organization } = await createTestOrg("Opp A");
    await buildDemoDataset(organization.id);
    try {
      const first = await handleOpportunityAnalysis(organization.id, demo);
      expect(first.created.length).toBeGreaterThan(0);
      expect(first.skipped).toBe(0);

      const rows = await prisma.opportunity.findMany({
        where: { organizationId: organization.id },
      });
      for (const row of rows) {
        expect(row.provenance).toBe("demo");
        expect(row.provider).toBe("demo");
        expect(row.status).toBe("open");
        expect(["low", "medium", "high"]).toContain(row.confidence);
        expect(row.title.length).toBeGreaterThan(0);
        expect(row.description).toMatch(/investigat|validat/i);
        const evidence = row.evidence as { id: string }[];
        expect(evidence.length).toBeGreaterThan(0);
      }

      // Rerun creates nothing new (titles already open).
      const second = await handleOpportunityAnalysis(organization.id, demo);
      expect(second.created).toHaveLength(0);
      expect(second.skipped).toBeGreaterThan(0);
      expect(await prisma.opportunity.count({ where: { organizationId: organization.id } })).toBe(
        rows.length,
      );
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("validates live output and drops ungrounded drafts", async () => {
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
            opportunities: [
              {
                title: "Real gap",
                description: "Worth investigating because X.",
                evidence: ["some evidence"],
                supportingData: { mentions: 3 },
                competitors: ["Nordwind"],
                painPoints: ["shipping"],
                differentiation: "Do Y.",
                confidence: "medium",
                citations: ["does-not-exist-999"],
              },
              {
                title: "Fake gap",
                description: "No evidence.",
                evidence: [],
                supportingData: {},
                competitors: [],
                painPoints: [],
                differentiation: "None.",
                confidence: "low",
                citations: ["also-bogus-123"],
              },
            ],
          },
        };
      },
    };
    const { user, organization } = await createTestOrg("OppLive");
    await buildDemoDataset(organization.id);
    try {
      // Seed one real review id into citations by patching: use a valid + bogus mix.
      // Here both drafts cite only bogus ids → both skipped (no ungrounded rows).
      const result = await handleOpportunityAnalysis(organization.id, stub);
      expect(result.created).toHaveLength(0);
      expect(await prisma.opportunity.count({ where: { organizationId: organization.id } })).toBe(
        0,
      );
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("rejects malformed live output loudly", async () => {
    const bad: AIProvider = {
      name: "bad",
      model: "bad-v1",
      async chat() {
        return { text: "", toolCalls: [] };
      },
      async analyze() {
        return { text: "{}", json: { opportunities: [{ title: 123 }] } };
      },
    };
    const { user, organization } = await createTestOrg("OppBad");
    await buildDemoDataset(organization.id);
    try {
      await expect(handleOpportunityAnalysis(organization.id, bad)).rejects.toThrow(/validation/i);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("opportunity queries + actions (scoped)", () => {
  it("lists open-first, archives/restores, blocks cross-org", async () => {
    const a = await createTestOrg("OppQ A");
    const b = await createTestOrg("OppQ B");
    await buildDemoDataset(a.organization.id);
    try {
      sessionFor(a.user);
      await handleOpportunityAnalysis(a.organization.id, demo);
      const list = await listOpportunities();
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((o) => ["low", "medium", "high"].includes(o.confidence))).toBe(true);

      const first = list[0]!;
      expect(await getOpportunity(first.id)).not.toBeNull();

      await archiveOpportunityAction(form({ id: first.id }));
      const after = await listOpportunities();
      expect(after.find((o) => o.id === first.id)?.status).toBe("archived");
      // open-first ordering: archived sinks below opens
      const openIdx = after.findIndex((o) => o.status === "open");
      const archIdx = after.findIndex((o) => o.id === first.id);
      if (openIdx !== -1) expect(openIdx).toBeLessThan(archIdx);

      await restoreOpportunityAction(form({ id: first.id }));
      expect((await getOpportunity(first.id))?.status).toBe("open");

      // cross-org id is invisible (scoped findUnique → null → NotFound throw)
      const bOpp = await prisma.opportunity.create({
        data: {
          organizationId: b.organization.id,
          title: "B gap",
          description: "B description worth investigating.",
          evidence: [],
          supportingData: {},
          competitors: [],
          painPoints: [],
          differentiation: "B diff.",
          confidence: "low",
          status: "open",
          provider: "demo",
          model: "demo-v1",
          provenance: "demo",
        },
      });
      expect(await getOpportunity(bOpp.id)).toBeNull();
      await expect(archiveOpportunityAction(form({ id: bOpp.id }))).rejects.toThrow();
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("demo opportunity rules (pure, deterministic)", () => {
  it("detects mid-tier pricing gaps and complaint thresholds", async () => {
    const { buildDemoOpportunities } = await import("@/server/ai/demo-content");
    const gap = buildDemoOpportunities({
      products: [
        { id: "p1", name: "Budget", category: "Widgets", price: 30, storeName: "S" },
        { id: "p2", name: "Premium", category: "Widgets", price: 150, storeName: "S" },
      ],
      reviewThemes: [],
      featureRequests: [],
      stores: [{ id: "s1", name: "S" }],
    });
    expect(gap.some((o) => o.title.includes("Mid-tier"))).toBe(true);
    expect(gap.every((o) => /investigat|validat/i.test(o.description))).toBe(true);

    // Single complaint does not trigger (needs recurrence).
    const thin = buildDemoOpportunities({
      products: [{ id: "p1", name: "X", category: "Y", price: 10, storeName: "S" }],
      reviewThemes: [{ theme: "shipping", count: 1, quotes: [{ id: "r1", quote: "slow" }] }],
      featureRequests: [],
      stores: [{ id: "s1", name: "S" }],
    });
    expect(thin).toEqual([]);
  });
});
