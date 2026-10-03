import { NextResponse } from "next/server";
import { apiContext, apiError, isResponse } from "@/server/api";
import { createTenantClient } from "@/server/db/tenant";
import { getAnalysis } from "@/modules/ai/queries";

/** Job status (+ result when done). Pure read; processing happens via /api/jobs/process. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;
  const { id } = await params;

  const db = createTenantClient(ctx.organizationId);
  const job = await db.job.findUnique({ where: { id } });
  if (!job) return apiError("not_found", "Job not found.", 404);

  const body: Record<string, unknown> = {
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      error: job.error,
      resultId: job.resultId,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    },
  };
  if (job.status === "done" && job.resultId) {
    body.analysis = await getAnalysis(job.resultId);
  }
  return NextResponse.json(body);
}
