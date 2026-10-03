import { NextResponse } from "next/server";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { createJob } from "@/server/db/jobs";

/**
 * Trigger a catalog sync (change detection). Always enqueues a fresh scan;
 * the handler dedupes against recorded events. Poll the job, then refresh.
 * Manual triggers only — automated scheduling is a documented extension point.
 */
export async function POST() {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;

  const limited = await checkApiRateLimit(ctx.organizationId, "monitoring:sync", 20, 3_600_000);
  if (limited) return limited;

  const job = await createJob(ctx.organizationId, "catalog_sync", {});
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}

export async function GET() {
  return apiError("method_not_allowed", "Use POST to trigger a sync.", 405);
}
