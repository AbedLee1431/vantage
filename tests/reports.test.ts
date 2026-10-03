import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import type { AIProvider } from "@/lib/ai";
import { DemoAIProvider } from "@/server/ai/providers";
import { handleReportGeneration } from "@/server/reports/generate";
import {
  buildCombinedSections,
  buildCompetitorSections,
  buildMonitoringSections,
} from "@/server/reports/builder";
import { POST as reportsPost } from "@/app/api/reports/route";
import { GET as csvGet } from "@/app/api/reports/[id]/csv/route";
import { GET as jobGet } from "@/app/api/jobs/[id]/route";
import { POST as jobsProcessPost } from "@/app/api/jobs/process/route";
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

const demo = new DemoAIProvider();

describe("report builders (frozen snapshots, empties omitted)", () => {
  it("assembles competitor sections with evidence refs", async () => {
    const { user, organization } = await seededOrg("RptBuild A");
    try {
      const store = await prisma.store.findFirst({ where: { organizationId: organization.id } });
      const built = await buildCompetitorSections(organization.id, store!.id);
      expect(built).not.toBeNull();
      expect(built!.title).toMatch(/Competitor Report/);
      expect(built!.sections.length).toBeGreaterThan(0);
      // every section carries provenance; tables have aligned columns/rows
      for (const s of built!.sections) {
        expect(["demo", "calculated"]).toContain((s as { provenance?: string }).provenance);
        if (s.kind === "table") {
          expect(s.rows.every((r) => r.length === s.columns.length)).toBe(true);
        }
      }
      expect(built!.evidence.length).toBeGreaterThan(0);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("omits empty sections instead of rendering placeholders", async () => {
    const { user, organization } = await createTestOrg("RptEmpty");
    try {
      const built = await buildCombinedSections(organization.id);
      // Empty workspace: stats sections exist (zero counts), no data tables.
      const tables = built.sections.filter((s) => s.kind === "table");
      expect(tables).toHaveLength(0);
      expect(built.sections.length).toBeGreaterThan(0);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("monitoring sections reflect recorded activity", async () => {
    const { user, organization } = await seededOrg("RptMon");
    try {
      const built = await buildMonitoringSections(organization.id);
      expect(built.sections.some((s) => s.key === "changes")).toBe(true);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("report generation handler (AI summary + persist)", () => {
  it("generates a labeled snapshot end-to-end via Demo", async () => {
    const { user, organization } = await seededOrg("RptGen");
    try {
      const store = await prisma.store.findFirst({ where: { organizationId: organization.id } });
      const report = await prisma.report.create({
        data: {
          organizationId: organization.id,
          type: "competitor",
          title: "Test",
          status: "queued",
          params: { storeId: store!.id },
          provenance: "demo",
        },
      });
      const { reportId } = await handleReportGeneration(organization.id, report.id, demo);
      const row = await prisma.report.findUnique({ where: { id: reportId } });
      expect(row?.status).toBe("done");
      expect(row?.provider).toBe("demo");
      const snapshot = row?.sections as {
        summary: string;
        findings: string[];
        sections: unknown[];
        disclaimers: string[];
      };
      expect(snapshot.summary).toMatch(/demo/i);
      expect(snapshot.findings.length).toBeGreaterThan(0);
      expect(snapshot.sections.length).toBeGreaterThan(0);
      expect(snapshot.disclaimers.join(" ")).toMatch(/validate/i);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("fails loudly on malformed model output (no partial snapshots)", async () => {
    const bad: AIProvider = {
      name: "bad",
      model: "bad-v1",
      async chat() {
        return { text: "", toolCalls: [] };
      },
      async analyze() {
        return { text: "{}", json: { summary: 123 } };
      },
    };
    const { user, organization } = await seededOrg("RptBad");
    try {
      const report = await prisma.report.create({
        data: {
          organizationId: organization.id,
          type: "trends",
          title: "Test",
          status: "queued",
          params: {},
          provenance: "demo",
        },
      });
      await expect(handleReportGeneration(organization.id, report.id, bad)).rejects.toThrow(
        /validation/i,
      );
      const row = await prisma.report.findUnique({ where: { id: report.id } });
      expect(row?.status).toBe("failed");
      expect(row?.error).toMatch(/validation/i);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("reports API (create, poll, CSV, isolation)", () => {
  it("creates via job, processes, and downloads section CSVs", async () => {
    const { user, organization } = await seededOrg("RptApi");
    try {
      sessionFor(user);
      const store = await prisma.store.findFirst({ where: { organizationId: organization.id } });

      const req = await reportsPost(
        postJson("http://x/api/reports", { type: "competitor", storeId: store!.id }),
      );
      expect(req.status).toBe(202);
      const { jobId, reportId } = (await req.json()) as { jobId: string; reportId: string };

      await jobsProcessPost(postJson("http://x/api/jobs/process", {}));
      const poll = await jobGet(new NextRequest(`http://x/api/jobs/${jobId}`), {
        params: Promise.resolve({ id: jobId }),
      });
      expect(((await poll.json()) as { job: { status: string } }).job.status).toBe("done");

      // CSV for a tabular section, serialized from the frozen snapshot.
      const csv = await csvGet(
        new NextRequest(`http://x/api/reports/${reportId}/csv?section=products`),
        { params: Promise.resolve({ id: reportId }) },
      );
      expect(csv.status).toBe(200);
      expect(csv.headers.get("content-type")).toContain("text/csv");
      expect(csv.headers.get("content-disposition")).toContain("attachment");
      const text = await csv.text();
      expect(text.split("\r\n")[0]).toBe("Product,Category,Price");

      // Non-tabular and missing sections reject cleanly.
      const badSection = await csvGet(
        new NextRequest(`http://x/api/reports/${reportId}/csv?section=nope`),
        { params: Promise.resolve({ id: reportId }) },
      );
      expect(badSection.status).toBe(400);
      const noParam = await csvGet(new NextRequest(`http://x/api/reports/${reportId}/csv`), {
        params: Promise.resolve({ id: reportId }),
      });
      expect(noParam.status).toBe(400);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("validates creation input and enforces tenancy", async () => {
    const a = await seededOrg("RptVal A");
    const b = await seededOrg("RptVal B");
    try {
      sessionFor(a.user);
      const badType = await reportsPost(postJson("http://x/api/reports", { type: "spaceship" }));
      expect(badType.status).toBe(400);
      const missingTarget = await reportsPost(
        postJson("http://x/api/reports", { type: "competitor" }),
      );
      expect(missingTarget.status).toBe(400);

      const bStore = await prisma.store.findFirst({ where: { organizationId: b.organization.id } });
      const cross = await reportsPost(
        postJson("http://x/api/reports", { type: "competitor", storeId: bStore!.id }),
      );
      expect(cross.status).toBe(404);

      const bReport = await prisma.report.create({
        data: {
          organizationId: b.organization.id,
          type: "trends",
          title: "B",
          status: "done",
          params: {},
          provenance: "demo",
        },
      });
      const crossCsv = await csvGet(
        new NextRequest(`http://x/api/reports/${bReport.id}/csv?section=x`),
        {
          params: Promise.resolve({ id: bReport.id }),
        },
      );
      expect(crossCsv.status).toBe(404);

      mockAuth.mockResolvedValue(null);
      const unauth = await reportsPost(postJson("http://x/api/reports", { type: "trends" }));
      expect(unauth.status).toBe(401);
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("report queries + delete action (scoped)", () => {
  it("lists with type filter, opens singles, deletes owned only", async () => {
    const a = await seededOrg("RptQ A");
    const b = await seededOrg("RptQ B");
    try {
      sessionFor(a.user);
      const { listReports, getReport } = await import("@/modules/reports/queries");
      const { deleteReportAction } = await import("@/modules/reports/actions");

      const mk = (type: "trends" | "monitoring", title: string) =>
        prisma.report.create({
          data: {
            organizationId: a.organization.id,
            type,
            title,
            status: "done",
            params: {},
            provenance: "demo",
          },
        });
      await mk("trends", "T1");
      await mk("monitoring", "M1");

      const all = await listReports({});
      expect(all.total).toBe(2);
      const filtered = await listReports({ type: "trends" });
      expect(filtered.total).toBe(1);
      expect(filtered.items[0]?.title).toBe("T1");

      const one = await getReport(all.items[0]!.id);
      expect(one?.title).toBe("M1");

      const bRow = await prisma.report.create({
        data: {
          organizationId: b.organization.id,
          type: "trends",
          title: "B",
          status: "done",
          params: {},
          provenance: "demo",
        },
      });
      expect(await getReport(bRow.id)).toBeNull();

      const fd = new FormData();
      fd.set("id", all.items[0]!.id);
      await deleteReportAction(fd);
      expect(await getReport(all.items[0]!.id)).toBeNull();

      const badFd = new FormData();
      badFd.set("id", bRow.id);
      await expect(deleteReportAction(badFd)).rejects.toThrow();
      expect(await prisma.report.findUnique({ where: { id: bRow.id } })).not.toBeNull();
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});
