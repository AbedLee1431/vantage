import { z } from "zod";
import { claimJob, completeJob, failJob, listQueuedJobs } from "../db/jobs";
import { createTenantClient } from "../db/tenant";
import { getAIProvider } from "../ai/providers";
import {
  handleAdAnalysis,
  handleCompetitorAnalysis,
  handleCatalogSync,
  handleOpportunityAnalysis,
  handleReviewSummary,
  sanitizeError,
} from "./handlers";
import { handleReportGeneration } from "../reports/generate";

/**
 * Job orchestration (ADR-007/011). Enqueue is instant (non-blocking); execution
 * is lazy (first poll / manual trigger / cron) via processPendingJobs. Status
 * transitions are atomic; races resolve to no-ops, never double-processing.
 * Runner never touches the base client (R2) — job rows via server/db/jobs,
 * tenant data via scoped clients.
 */

const adPayloadSchema = z.object({ adId: z.string().min(1).max(50) });
const competitorPayloadSchema = z.object({ storeId: z.string().min(1).max(50) });
const reviewSummaryPayloadSchema = z.object({
  productId: z.string().min(1).max(50).optional(),
  storeId: z.string().min(1).max(50).optional(),
});
const opportunityPayloadSchema = z.object({});
const catalogSyncPayloadSchema = z.object({});
const reportPayloadSchema = z.object({ reportId: z.string().min(1).max(50) });

export type ProcessOutcome =
  | { status: "done"; analysisId: string }
  | { status: "failed"; error: string }
  | { status: "queued" | "running" };

export async function processJob(jobId: string, organizationId: string): Promise<ProcessOutcome> {
  const db = createTenantClient(organizationId);
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found.");
  if (job.status === "done") {
    return { status: "done", analysisId: job.resultId ?? "" };
  }
  if (job.status === "failed") {
    return { status: "failed", error: job.error ?? "Job failed." };
  }
  if (job.status !== "queued") {
    return { status: job.status };
  }

  const claimed = await claimJob(jobId);
  if (!claimed) {
    // Lost a race (another poll/cron took it) — report, don't duplicate.
    const current = await db.job.findUnique({ where: { id: jobId } });
    if (!current || current.status === "queued") return { status: "queued" };
    if (current.status === "done") return { status: "done", analysisId: current.resultId ?? "" };
    if (current.status === "failed")
      return { status: "failed", error: current.error ?? "Job failed." };
    return { status: current.status };
  }

  try {
    // AI provider resolves lazily per AI job (sync jobs need none — a misconfigured
    // provider must never block monitoring).
    const providerFor = () => getAIProvider();
    let analysisId: string;
    if (claimed.type === "ad_analysis") {
      const payload = adPayloadSchema.parse(claimed.payload);
      ({ analysisId } = await handleAdAnalysis(organizationId, payload.adId, providerFor()));
    } else if (claimed.type === "competitor_analysis") {
      const payload = competitorPayloadSchema.parse(claimed.payload);
      ({ analysisId } = await handleCompetitorAnalysis(
        organizationId,
        payload.storeId,
        providerFor(),
      ));
    } else if (claimed.type === "review_summary") {
      const payload = reviewSummaryPayloadSchema.parse(claimed.payload);
      ({ analysisId } = await handleReviewSummary(
        organizationId,
        { productId: payload.productId, storeId: payload.storeId },
        providerFor(),
      ));
    } else if (claimed.type === "opportunity_analysis") {
      opportunityPayloadSchema.parse(claimed.payload);
      await handleOpportunityAnalysis(organizationId, providerFor());
      // No single result (rows appear in the list); empty id signals list-refresh.
      analysisId = "";
    } else if (claimed.type === "catalog_sync") {
      catalogSyncPayloadSchema.parse(claimed.payload);
      await handleCatalogSync(organizationId);
      // Changes surface in timeline/alerts; empty id signals list-refresh.
      analysisId = "";
    } else if (claimed.type === "report_generation") {
      const payload = reportPayloadSchema.parse(claimed.payload);
      ({ reportId: analysisId } = await handleReportGeneration(
        organizationId,
        payload.reportId,
        providerFor(),
      ));
    } else {
      throw new Error(`Unsupported job type "${claimed.type}".`);
    }
    await completeJob(jobId, analysisId);
    return { status: "done", analysisId };
  } catch (error) {
    const message = sanitizeError(error);
    await failJob(jobId, message);
    return { status: "failed", error: message };
  }
}

/** Run up to `limit` queued jobs (one org, or all orgs for cron with null). */
export async function processPendingJobs(
  organizationId: string | null,
  limit: number,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const queued = await listQueuedJobs(organizationId, limit);
  let succeeded = 0;
  let failed = 0;
  for (const job of queued) {
    try {
      const outcome = await processJob(job.id, job.organizationId);
      if (outcome.status === "done") succeeded++;
      else if (outcome.status === "failed") failed++;
    } catch {
      failed++;
    }
  }
  return { processed: queued.length, succeeded, failed };
}
