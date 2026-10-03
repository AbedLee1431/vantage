import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import { toEvidenceRefs } from "@/lib/ai";
import { POST as summarizePost } from "@/app/api/ai/reviews/summarize/route";
import { POST as oppAnalyzePost } from "@/app/api/ai/opportunities/analyze/route";
import { GET as jobGet } from "@/app/api/jobs/[id]/route";
import { POST as jobsProcessPost } from "@/app/api/jobs/process/route";
import { callTool } from "@/server/ai/tools";
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

async function seededOrg(name: string) {
  const created = await createTestOrg(name);
  await buildDemoDataset(created.organization.id);
  return created;
}

describe("review summary API (job-backed, cached)", () => {
  it("summarizes a product scope end-to-end and caches repeats", async () => {
    const { user, organization } = await seededOrg("Sum A");
    try {
      sessionFor(user);
      const jacket = await prisma.product.findFirst({
        where: { organizationId: organization.id, name: { contains: "Jacket" } },
      });

      const req = await summarizePost(
        postJson("http://x/api/ai/reviews/summarize", { productId: jacket!.id }),
      );
      expect(req.status).toBe(202);
      const { jobId } = (await req.json()) as { jobId: string };

      await jobsProcessPost(postJson("http://x/api/jobs/process", {}));
      const poll = await jobGet(new NextRequest(`http://x/api/jobs/${jobId}`), {
        params: Promise.resolve({ id: jobId }),
      });
      const body = (await poll.json()) as {
        job: { status: string };
        analysis: { id: string; result: { sections: { key: string }[] } };
      };
      expect(body.job.status).toBe("done");
      expect(body.analysis.result.sections.map((s) => s.key)).toContain("sentiment");

      // repeat → same analysis via cache (no duplicate row)
      await summarizePost(postJson("http://x/api/ai/reviews/summarize", { productId: jacket!.id }));
      await jobsProcessPost(postJson("http://x/api/jobs/process", {}));
      expect(
        await prisma.aiAnalysis.count({
          where: { organizationId: organization.id, kind: "review_summary" },
        }),
      ).toBe(1);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("validates scope (400 both, 404 unknown) and handles empty scopes honestly", async () => {
    const { user, organization } = await seededOrg("Sum B");
    const bare = await createTestOrg("SumEmpty");
    try {
      sessionFor(user);
      const both = await summarizePost(
        postJson("http://x/api/ai/reviews/summarize", { productId: "x", storeId: "y" }),
      );
      expect(both.status).toBe(400);
      const missing = await summarizePost(
        postJson("http://x/api/ai/reviews/summarize", { productId: "c".repeat(25) }),
      );
      expect(missing.status).toBe(404);

      sessionFor(bare.user);
      const emptyReq = await summarizePost(postJson("http://x/api/ai/reviews/summarize", {}));
      expect(emptyReq.status).toBe(202);
      const { jobId } = (await emptyReq.json()) as { jobId: string };
      await jobsProcessPost(postJson("http://x/api/jobs/process", {}));
      const poll = await jobGet(new NextRequest(`http://x/api/jobs/${jobId}`), {
        params: Promise.resolve({ id: jobId }),
      });
      const body = (await poll.json()) as {
        job: { status: string };
        analysis: { result: { sections: unknown[] } };
      };
      expect(body.job.status).toBe("done");
      expect(body.analysis.result.sections.length).toBeGreaterThan(0);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
      await deleteTestOrg(bare.organization.id, [bare.user.id]);
    }
  });
});

describe("opportunities API (scan, dedupe, list)", () => {
  it("runs gap analysis, persists hedged rows, dedupes reruns", async () => {
    const { user, organization } = await seededOrg("OppApi");
    try {
      sessionFor(user);
      const req = await oppAnalyzePost(postJson("http://x/api/ai/opportunities/analyze", {}));
      expect(req.status).toBe(202);
      const { jobId } = (await req.json()) as { jobId: string };

      await jobsProcessPost(postJson("http://x/api/jobs/process", {}));
      const poll = await jobGet(new NextRequest(`http://x/api/jobs/${jobId}`), {
        params: Promise.resolve({ id: jobId }),
      });
      expect(((await poll.json()) as { job: { status: string } }).job.status).toBe("done");

      const rows = await prisma.opportunity.findMany({
        where: { organizationId: organization.id },
      });
      expect(rows.length).toBeGreaterThan(0);

      const again = await oppAnalyzePost(postJson("http://x/api/ai/opportunities/analyze", {}));
      const { jobId: job2 } = (await again.json()) as { jobId: string };
      await jobsProcessPost(postJson("http://x/api/jobs/process", {}));
      const poll2 = await jobGet(new NextRequest(`http://x/api/jobs/${job2}`), {
        params: Promise.resolve({ id: job2 }),
      });
      expect(((await poll2.json()) as { job: { status: string } }).job.status).toBe("done");
      expect(await prisma.opportunity.count({ where: { organizationId: organization.id } })).toBe(
        rows.length,
      );
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("analyst review/opportunity tools (scoped)", () => {
  it("computes insights and lists opportunities per org", async () => {
    const a = await seededOrg("ToolsRev A");
    const b = await seededOrg("ToolsRev B");
    try {
      const insights = (await callTool(a.organization.id, "getReviewInsights", {})) as {
        total: number;
      };
      expect(insights.total).toBe(8);

      const opps = (await callTool(a.organization.id, "listOpportunities", {})) as unknown[];
      expect(Array.isArray(opps)).toBe(true);

      // B's isolation holds through tools (tested broadly elsewhere; spot-check empty tools)
      const bInsights = (await callTool(b.organization.id, "getReviewInsights", {})) as {
        total: number;
      };
      expect(bInsights.total).toBe(8);
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("toEvidenceRefs (citation display coercion)", () => {
  it("keeps valid refs and drops malformed entries", () => {
    expect(
      toEvidenceRefs([
        { type: "product", id: "p1", label: "Jacket" },
        { type: "spaceship", id: "x", label: "Y" },
        { type: "ad", id: 123, label: "Z" },
        null,
        "nope",
      ]),
    ).toEqual([{ type: "product", id: "p1", label: "Jacket" }]);
    expect(toEvidenceRefs(null)).toEqual([]);
    expect(toEvidenceRefs("x")).toEqual([]);
  });
});
