import { NextRequest, NextResponse } from "next/server";
import { analyzeAdRequestSchema } from "@/lib/validation";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { AIConfigurationError } from "@/server/ai/providers";
import { requestAnalysis } from "@/server/ai/request";
import { OverQuotaError, recordUsage, requireUsageQuota } from "@/server/billing/subscriptions";
import { createTenantClient } from "@/server/db/tenant";
import { getAnalysis } from "@/modules/ai/queries";

/** Request AI ad analysis. Cached hits return 200; misses enqueue a job (202). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;
  const { id } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body allowed ({ force } optional)
  }
  if (!analyzeAdRequestSchema.safeParse(body).success) {
    return apiError("validation", "Invalid request.", 400);
  }
  const force = (body as { force?: unknown }).force === true;

  const limited = await checkApiRateLimit(ctx.organizationId, "ai:analyze", 10, 3_600_000);
  if (limited) return limited;

  const db = createTenantClient(ctx.organizationId);
  const ad = await db.ad.findUnique({ where: { id }, select: { id: true, updatedAt: true } });
  if (!ad) return apiError("not_found", "Ad not found.", 404);

  try {
    await requireUsageQuota(ctx.organizationId, "ai_analysis");
  } catch (error) {
    if (error instanceof OverQuotaError) {
      return apiError("over_quota", `${error.message} Visit /billing to upgrade.`, 429);
    }
    throw error;
  }

  try {
    const outcome = await requestAnalysis({
      organizationId: ctx.organizationId,
      kind: "ad",
      targetRef: ad.id,
      targetUpdatedAt: ad.updatedAt,
      force,
      payload: { adId: ad.id },
    });
    if (outcome.cached) {
      const analysis = await getAnalysis(outcome.analysisId);
      return NextResponse.json({ cached: true, analysisId: outcome.analysisId, analysis });
    }
    // Meter only fresh analyses — cache hits cost nothing.
    await recordUsage(ctx.organizationId, "ai_analysis");
    return NextResponse.json({ cached: false, jobId: outcome.jobId }, { status: 202 });
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return apiError("ai_configuration", error.message, 500);
    }
    throw error;
  }
}
