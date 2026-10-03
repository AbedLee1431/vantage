import { NextRequest, NextResponse } from "next/server";
import { analyzeCompetitorRequestSchema } from "@/lib/validation";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { AIConfigurationError } from "@/server/ai/providers";
import { requestAnalysis } from "@/server/ai/request";
import { OverQuotaError, recordUsage, requireUsageQuota } from "@/server/billing/subscriptions";
import { createTenantClient } from "@/server/db/tenant";
import { getAnalysis } from "@/modules/ai/queries";

/** Request AI competitor analysis for a known store (by id or domain). */
export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Invalid request.", 400);
  }
  const parsed = analyzeCompetitorRequestSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.storeId && !parsed.data.domain)) {
    return apiError("validation", "Provide storeId or domain.", 400);
  }

  const limited = await checkApiRateLimit(ctx.organizationId, "ai:analyze", 10, 3_600_000);
  if (limited) return limited;

  const db = createTenantClient(ctx.organizationId);
  const store = parsed.data.storeId
    ? await db.store.findUnique({
        where: { id: parsed.data.storeId },
        select: { id: true, updatedAt: true },
      })
    : await db.store.findFirst({
        where: { domain: { equals: parsed.data.domain, mode: "insensitive" } },
        select: { id: true, updatedAt: true },
      });
  if (!store) {
    return apiError("not_found", "No data for this store in your workspace.", 404);
  }

  try {
    await requireUsageQuota(ctx.organizationId, "competitor_analysis");
  } catch (error) {
    if (error instanceof OverQuotaError) {
      return apiError("over_quota", `${error.message} Visit /billing to upgrade.`, 429);
    }
    throw error;
  }

  try {
    const outcome = await requestAnalysis({
      organizationId: ctx.organizationId,
      kind: "competitor",
      targetRef: store.id,
      targetUpdatedAt: store.updatedAt,
      force: parsed.data.force,
      payload: { storeId: store.id },
    });
    if (outcome.cached) {
      const analysis = await getAnalysis(outcome.analysisId);
      return NextResponse.json({ cached: true, analysisId: outcome.analysisId, analysis });
    }
    await recordUsage(ctx.organizationId, "competitor_analysis");
    return NextResponse.json({ cached: false, jobId: outcome.jobId }, { status: 202 });
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return apiError("ai_configuration", error.message, 500);
    }
    throw error;
  }
}
