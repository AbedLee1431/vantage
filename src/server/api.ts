import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { requireOrg } from "@/server/db/tenant";
import { checkRateLimit } from "@/server/db/ratelimit";
import { ForbiddenError } from "@/server/errors";
import type { SessionUser } from "@/server/db/tenant";

/**
 * Shared REST helpers (API-Spec §2). All custom API routes authenticate here —
 * the proxy matcher intentionally excludes /api/* (APIs return JSON 401, never
 * redirects).
 */

export function apiError(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export type ApiContext = { user: SessionUser; organizationId: string };

export async function apiContext(): Promise<ApiContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return apiError("unauthorized", "Sign in required.", 401);
  }
  try {
    const { user, organizationId } = await requireOrg();
    return { user, organizationId };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return apiError("forbidden", "No workspace access.", 403);
    }
    throw error;
  }
}

export function isResponse(value: ApiContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

/** DB-backed per-org rate limit. Returns a 429 Response when exhausted, else null. */
export async function checkApiRateLimit(
  organizationId: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(`${key}:${organizationId}`, limit, windowMs);
  if (!result.allowed) {
    return apiError("rate_limited", "Too many requests. Please try again later.", 429);
  }
  return null;
}
