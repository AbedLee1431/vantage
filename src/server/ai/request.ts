import { createTenantClient } from "../db/tenant";
import { createJob } from "../db/jobs";
import { getAIProvider } from "./providers";
import { findCachedAnalysis, promptHash } from "../jobs/handlers";

/**
 * Shared analysis request (ad + competitor routes). Checks the prompt-hash
 * cache first (repeat analyses never enqueue or bill a provider call), then
 * creates a queued Job for lazy/cron processing. Returns cached rows directly.
 */

export async function requestAnalysis(input: {
  organizationId: string;
  kind: "ad" | "competitor";
  targetRef: string;
  targetUpdatedAt: Date;
  force?: boolean;
  payload: { adId?: string; storeId?: string };
}): Promise<{ cached: true; analysisId: string } | { cached: false; jobId: string }> {
  const provider = getAIProvider();
  const db = createTenantClient(input.organizationId);

  if (!input.force) {
    const hash = promptHash(input.kind, input.targetRef, input.targetUpdatedAt, provider);
    const hit = await findCachedAnalysis(db, input.kind, input.targetRef, hash);
    if (hit) return { cached: true, analysisId: hit.id };
  }

  const job = await createJob(
    input.organizationId,
    input.kind === "ad" ? "ad_analysis" : "competitor_analysis",
    input.payload as unknown as object,
  );
  return { cached: false, jobId: job.id };
}
