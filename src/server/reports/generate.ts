import type { ReportType } from "@/generated/client";
import { REPORT_SUMMARY_SYSTEM, reportSummarySchema } from "../ai/prompts";
import type { AIProvider } from "@/lib/ai";
import { createTenantClient } from "../db/tenant";
import { resolveCitations, sanitizeError } from "../jobs/handlers";
import { buildDemoReportSummary } from "../ai/demo-content";
import {
  buildAdvertisingSections,
  buildCombinedSections,
  buildCompetitorSections,
  buildCustomerSections,
  buildMonitoringSections,
  buildProductSections,
  buildTrendsSections,
  type BuiltSections,
} from "./builder";

/**
 * Report generation orchestration (Phase 7). Loads the queued Report row,
 * assembles frozen sections, generates one AI summary + findings, validates,
 * verifies citations, and persists the snapshot. Reports are historical records
 * (never cached/deduped) — reruns create new rows.
 */

export type ReportParams = {
  storeId?: string;
  productId?: string;
  advertiserId?: string;
  platform?: string;
};

export async function handleReportGeneration(
  organizationId: string,
  reportId: string,
  provider: AIProvider,
): Promise<{ reportId: string }> {
  const db = createTenantClient(organizationId);
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Report not found.");
  if (report.status === "done") return { reportId };
  if (report.status !== "queued") throw new Error(`Report is ${report.status}.`);

  await db.report.update({
    where: { id: reportId },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    return await generateInner(db, organizationId, reportId, report, provider);
  } catch (error) {
    await db.report.update({
      where: { id: reportId },
      data: { status: "failed", error: sanitizeError(error), finishedAt: new Date() },
    });
    throw error;
  }
}

async function generateInner(
  db: ReturnType<typeof createTenantClient>,
  organizationId: string,
  reportId: string,
  report: { type: string; params: unknown },
  provider: AIProvider,
): Promise<{ reportId: string }> {
  const params = (report.params ?? {}) as ReportParams;
  let built: BuiltSections | null;
  switch (report.type as ReportType) {
    case "competitor":
      if (!params.storeId) throw new Error("Competitor reports require a store.");
      built = await buildCompetitorSections(organizationId, params.storeId);
      break;
    case "product":
      if (!params.productId) throw new Error("Product reports require a product.");
      built = await buildProductSections(organizationId, params.productId);
      break;
    case "advertising":
      built = await buildAdvertisingSections(organizationId, {
        advertiserId: params.advertiserId,
        platform: params.platform,
      });
      break;
    case "customer":
      built = await buildCustomerSections(organizationId, {
        productId: params.productId,
        storeId: params.storeId,
      });
      break;
    case "trends":
      built = await buildTrendsSections(organizationId);
      break;
    case "monitoring":
      built = await buildMonitoringSections(organizationId);
      break;
    case "combined":
      built = await buildCombinedSections(organizationId);
      break;
    default:
      throw new Error(`Unsupported report type.`);
  }
  if (!built) throw new Error("Report target no longer exists.");

  let summary: string;
  let findings: string[];
  if (provider.name === "demo") {
    ({ summary, findings } = buildDemoReportSummary(report.type, built.title, built.factSheet));
  } else {
    const { json } = await provider.analyze({
      system: REPORT_SUMMARY_SYSTEM,
      user: JSON.stringify({
        task: `Write an executive summary (2-4 sentences) and 3-5 key findings for this ${report.type} report.`,
        title: built.title,
        facts: built.factSheet,
        sections: built.sections.map((s) => ({ key: s.key, title: s.title })),
      }),
      evidence: { kind: "report", type: report.type },
    });
    const parsed = reportSummarySchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Model output failed validation (${parsed.error.issues.length} issue(s)).`);
    }
    summary = parsed.data.summary;
    findings = parsed.data.findings;
  }

  // Evidence refs were collected from rows read via the tenant client; verify
  // defensively (drops nothing in practice, guards live-model contamination).
  const ids = built.evidence.map((e) => e.id);
  const { verified } = await resolveCitations(db, ids);

  const disclaimers = [
    provider.name === "demo"
      ? "Demo AI summary — deterministic template, not a language model."
      : "AI-generated summary grounded in the cited workspace rows.",
    "Demo data throughout — not externally verified intelligence.",
    "Validate before acting.",
  ];

  await db.report.update({
    where: { id: reportId },
    data: {
      status: "done",
      sections: {
        summary,
        findings,
        sections: built.sections,
        disclaimers,
      } as unknown as object,
      evidence: verified as unknown as object,
      provider: provider.name,
      model: provider.model,
      finishedAt: new Date(),
      title: built.title,
    },
  });
  return { reportId };
}
