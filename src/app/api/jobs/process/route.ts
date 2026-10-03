import { NextRequest, NextResponse } from "next/server";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { processPendingJobs } from "@/server/jobs/runner";

/**
 * Run queued jobs. Session callers process their own org (limit 5); cron with a
 * valid CRON_SECRET processes all orgs (limit 10). Same entrypoint Vercel Cron
 * will call in production (ADR-011).
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCron) {
    const outcome = await processPendingJobs(null, 10);
    return NextResponse.json(outcome);
  }

  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;

  const limited = await checkApiRateLimit(ctx.organizationId, "ai:process", 20, 3_600_000);
  if (limited) return limited;

  const outcome = await processPendingJobs(ctx.organizationId, 5);
  return NextResponse.json(outcome);
}

export async function GET() {
  return apiError("method_not_allowed", "Use POST to process jobs.", 405);
}
