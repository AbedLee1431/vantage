import { NextRequest, NextResponse } from "next/server";
import { createReportSchema } from "@/lib/validation";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { AIConfigurationError, getAIProvider } from "@/server/ai/providers";
import { createJob } from "@/server/db/jobs";
import { OverQuotaError, recordUsage, requireUsageQuota } from "@/server/billing/subscriptions";
import { createTenantClient } from "@/server/db/tenant";

/**
 * Create a report (validates type + targets, persists a queued row, enqueues a
 * generation job). Returns both ids; the client polls the job, then opens the
 * report. Reports are historical snapshots — reruns create new rows, never cache.
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
  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation", "Invalid report request.", 400, parsed.error.issues);
  }
  const { type } = parsed.data;

  const limited = await checkApiRateLimit(ctx.organizationId, "reports:create", 10, 3_600_000);
  if (limited) return limited;

  try {
    await requireUsageQuota(ctx.organizationId, "report_generation");
  } catch (error) {
    if (error instanceof OverQuotaError) {
      return apiError("over_quota", `${error.message} Visit /billing to upgrade.`, 429);
    }
    throw error;
  }

  const db = createTenantClient(ctx.organizationId);

  // Resolve title + verify targets exist (404 now, not a failed job later).
  let title = "";
  if (type === "competitor") {
    const store = await db.store.findUnique({
      where: { id: parsed.data.storeId },
      select: { id: true, name: true },
    });
    if (!store) return apiError("not_found", "Store not found.", 404);
    title = `Competitor Report — ${store.name}`;
  } else if (type === "product") {
    const product = await db.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, name: true },
    });
    if (!product) return apiError("not_found", "Product not found.", 404);
    title = `Product Intelligence — ${product.name}`;
  } else if (type === "advertising") {
    if (parsed.data.advertiserId) {
      const advertiser = await db.advertiser.findUnique({
        where: { id: parsed.data.advertiserId },
        select: { id: true, name: true },
      });
      if (!advertiser) return apiError("not_found", "Advertiser not found.", 404);
      title = `Advertising Report — ${advertiser.name}`;
    } else {
      title = "Advertising Report";
    }
  } else if (type === "customer") {
    title = "Customer Intelligence Report";
  } else if (type === "trends") {
    title = "Market Trends Report";
  } else if (type === "monitoring") {
    title = "Monitoring Report";
  } else {
    title = "Combined Intelligence Report";
  }

  try {
    getAIProvider();
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return apiError("ai_configuration", error.message, 500);
    }
    throw error;
  }

  const report = await db.report.create({
    data: {
      organizationId: ctx.organizationId,
      type,
      title,
      status: "queued",
      params: {
        ...(parsed.data.storeId ? { storeId: parsed.data.storeId } : {}),
        ...(parsed.data.productId ? { productId: parsed.data.productId } : {}),
        ...(parsed.data.advertiserId ? { advertiserId: parsed.data.advertiserId } : {}),
        ...(parsed.data.platform ? { platform: parsed.data.platform } : {}),
      },
      provenance: "demo",
    },
  });
  const job = await createJob(ctx.organizationId, "report_generation", { reportId: report.id });
  await recordUsage(ctx.organizationId, "report_generation");
  return NextResponse.json({ jobId: job.id, reportId: report.id }, { status: 202 });
}
