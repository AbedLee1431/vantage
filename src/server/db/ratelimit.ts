import { prisma } from "./client";

/**
 * DB-backed rate limiting (ADR-011: Postgres, never in-memory, so limits hold
 * for one instance, many instances, or serverless cold starts).
 *
 * Keys are caller-chosen identifiers (e.g. `login:email:<email>`). Phase 1 keys
 * by account identifier rather than IP — simpler, testable, and sufficient for
 * an MVP with no public signup abuse yet.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.expiresAt <= now) {
    const expiresAt = new Date(now.getTime() + windowMs);
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: 1, expiresAt },
    });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: expiresAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.expiresAt };
  }

  const updated = await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return {
    allowed: true,
    remaining: Math.max(0, limit - updated.count),
    resetAt: updated.expiresAt,
  };
}
