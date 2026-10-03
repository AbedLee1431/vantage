import type { JobStatus, JobType, Prisma } from "@/generated/client";
import { prisma } from "./client";

/**
 * Job table access. The ONLY place that touches Job rows with the base client
 * (R2). Cron (no session) lists/claims across orgs here; everything else goes
 * through tenant-scoped callers. Status transitions are atomic to prevent
 * double-processing between lazy polls and cron.
 */

export type JobRow = {
  id: string;
  organizationId: string;
  type: JobType;
  status: JobStatus;
  payload: Prisma.JsonValue;
  resultId: string | null;
  error: string | null;
  attempts: number;
};

export async function createJob(
  organizationId: string,
  type: JobType,
  payload: Prisma.InputJsonValue,
): Promise<JobRow> {
  return prisma.job.create({
    data: { organizationId, type, status: "queued", payload },
  }) as Promise<JobRow>;
}

/** Atomically claim a queued job (queued → running). Returns null if taken. */
export async function claimJob(jobId: string): Promise<JobRow | null> {
  const updated = await prisma.job.updateMany({
    where: { id: jobId, status: "queued" },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (updated.count === 0) return null;
  return prisma.job.findUnique({ where: { id: jobId } }) as Promise<JobRow | null>;
}

export async function completeJob(jobId: string, resultId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "done", resultId, finishedAt: new Date(), error: null },
  });
}

export async function failJob(jobId: string, error: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "failed", error: error.slice(0, 2000), finishedAt: new Date() },
  });
}

/** Queued jobs for one org (session flows) or all orgs (cron). Oldest first. */
export async function listQueuedJobs(
  organizationId: string | null,
  limit: number,
): Promise<JobRow[]> {
  return prisma.job.findMany({
    where: { status: "queued", ...(organizationId ? { organizationId } : {}) },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 20)),
  }) as Promise<JobRow[]>;
}
