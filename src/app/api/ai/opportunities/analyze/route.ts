import { NextRequest, NextResponse } from "next/server";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { AIConfigurationError, getAIProvider } from "@/server/ai/providers";
import { createJob } from "@/server/db/jobs";
import { OverQuotaError, recordUsage, requireUsageQuota } from "@/server/billing/subscriptions";

/**
 * Request org-wide gap analysis. Always enqueues a fresh scan (dedupe prevents
 * duplicate open opportunities); poll the job, then refresh the list.
 */
export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;
  void req;

  const limited = await checkApiRateLimit(ctx.organizationId, "ai:analyze", 10, 3_600_000);
  if (limited) return limited;

  try {
    await requireUsageQuota(ctx.organizationId, "ai_analysis");
  } catch (error) {
    if (error instanceof OverQuotaError) {
      return apiError("over_quota", `${error.message} Visit /billing to upgrade.`, 429);
    }
    throw error;
  }

  try {
    getAIProvider();
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return apiError("ai_configuration", error.message, 500);
    }
    throw error;
  }

  const job = await createJob(ctx.organizationId, "opportunity_analysis", {});
  await recordUsage(ctx.organizationId, "ai_analysis");
  return NextResponse.json({ cached: false, jobId: job.id }, { status: 202 });
}
