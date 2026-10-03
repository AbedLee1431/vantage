import { NextRequest, NextResponse } from "next/server";
import { reviewSummaryRequestSchema } from "@/lib/validation";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { AIConfigurationError, getAIProvider } from "@/server/ai/providers";
import { createJob } from "@/server/db/jobs";
import { OverQuotaError, recordUsage, requireUsageQuota } from "@/server/billing/subscriptions";
import { createTenantClient } from "@/server/db/tenant";

/**
 * Request an AI pain-point summary for a scope. Always enqueues (the handler
 * checks the content-hash cache); poll the job for completion.
 */
export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Invalid request.", 400);
  }
  const parsed = reviewSummaryRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("validation", "Invalid request.", 400);
  const { productId, storeId } = parsed.data;
  if (productId && storeId) {
    return apiError("validation", "Provide productId or storeId, not both.", 400);
  }

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

  // Validate scope exists (404 now, not a failed job later).
  const db = createTenantClient(ctx.organizationId);
  if (productId) {
    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return apiError("not_found", "Product not found.", 404);
  }
  if (storeId) {
    const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) return apiError("not_found", "Store not found.", 404);
  }

  try {
    getAIProvider();
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return apiError("ai_configuration", error.message, 500);
    }
    throw error;
  }

  const job = await createJob(ctx.organizationId, "review_summary", {
    ...(productId ? { productId } : {}),
    ...(storeId ? { storeId } : {}),
  });
  await recordUsage(ctx.organizationId, "ai_analysis");
  return NextResponse.json({ cached: false, jobId: job.id }, { status: 202 });
}
