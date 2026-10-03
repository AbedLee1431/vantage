import { cache } from "react";
import { prisma } from "./client";
import { auth } from "../auth";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors";

/**
 * Server-side tenant isolation (NFR-TENANT-01, R2, ADR-015).
 *
 * Every tenant-owned model carries `organizationId`. This module is the ONLY place
 * allowed to import the base Prisma client for tenant data (enforced by an ESLint
 * `no-restricted-imports` ban). Application code must go through `tenantDb()`.
 *
 * Fail-closed by construction: TENANT models are scoped; IDENTITY models throw a
 * guiding error (query them via server/db/identity); UNREGISTERED models throw.
 * Adding a table without registering it can only break queries visibly in
 * dev/tests — never silently leak cross-tenant rows. Further rules:
 * - `findUnique*` is rewritten to scoped `findFirst*` (ids are globally unique PKs).
 * - Singular `update`/`delete` verify ownership first, then delegate.
 * - `upsert` is rejected on tenant models — use findFirst + create/update instead.
 * - Nested writes do NOT pass through the extension; always create top-level rows.
 * - No raw SQL anywhere (NFR-SEC-05), so `$queryRaw` scoping is a non-issue.
 */

const TENANT_MODELS = new Set([
  "Store",
  "Product",
  "Advertiser",
  "Ad",
  "LandingPage",
  "Review",
  "Competitor",
  "Watchlist",
  "WatchlistItem",
  "ChangeEvent",
  "AiAnalysis",
  "AiConversation",
  "AiMessage",
  "Job",
  "Opportunity",
  "Alert",
  "SyncState",
  "Report",
  "Subscription",
  "UsageRecord",
]);

const IDENTITY_MODELS = new Set([
  "User",
  "Organization",
  "Membership",
  "PasswordResetToken",
  "RateLimit",
]);

type MutableArgs = {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
  [key: string]: unknown;
};

// `any` is deliberate here: extension args are operation-dependent unions that cannot
// be narrowed usefully. The public tenantDb() API remains fully typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelDelegate = Record<string, (args: any) => Promise<any>>;

function baseModel(model: string): ModelDelegate {
  const delegate = (prisma as unknown as Record<string, ModelDelegate>)[model];
  if (!delegate) throw new Error(`tenant-isolation: unknown model ${model}`);
  return delegate;
}

export function createTenantClient(organizationId: string) {
  return prisma.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        // Types are inferred from the extension definition; internal mutation
        // uses MutableArgs casts. Public callers get full type safety.
        $allOperations: async ({ model, operation, args, query }) => {
          if (!model) {
            throw new Error("tenant-isolation: missing model name.");
          }
          if (IDENTITY_MODELS.has(model)) {
            throw new Error(
              `tenant-isolation: ${model} has no organization scope; query it via server/db/identity or the base client in server/db, never through a tenant client.`,
            );
          }
          if (!TENANT_MODELS.has(model)) {
            throw new Error(
              `tenant-isolation: unregistered model ${model}; add it to TENANT_MODELS (with organizationId) or query global tables via the base client.`,
            );
          }
          const delegate = baseModel(model);
          const a = (args ?? {}) as MutableArgs;

          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            const finder = operation === "findUnique" ? "findFirst" : "findFirstOrThrow";
            const find = delegate[finder];
            if (typeof find !== "function") {
              throw new Error(`tenant-isolation: cannot scope ${model}.${operation}`);
            }
            return find({
              ...a,
              where: { ...(a.where ?? {}), organizationId },
            });
          }

          if (
            operation === "create" ||
            operation === "createMany" ||
            operation === "createManyAndReturn"
          ) {
            const data = a.data;
            const scopedData = Array.isArray(data)
              ? data.map((row) => ({ ...(row as Record<string, unknown>), organizationId }))
              : { ...((data as Record<string, unknown>) ?? {}), organizationId };
            return query({ ...a, data: scopedData });
          }

          if (operation === "update" || operation === "delete") {
            const where = (a.where ?? {}) as Record<string, unknown>;
            const findFirst = delegate["findFirst"];
            if (typeof findFirst !== "function") {
              throw new Error(`tenant-isolation: cannot scope ${model}.${operation}`);
            }
            // Select the discriminator (every tenant model carries it, including
            // models like SyncState whose primary key IS organizationId).
            const owned = await findFirst({
              where: { ...where, organizationId },
              select: { organizationId: true },
            });
            if (!owned) {
              // Same observable behavior as Prisma's "record not found", without
              // leaking whether the id exists in another organization.
              throw new NotFoundError(`${model} not found`);
            }
            return query(args);
          }

          if (operation === "upsert") {
            throw new Error(
              `tenant-isolation: upsert is not supported on tenant model ${model}; ` +
                `use findFirst + create/update instead`,
            );
          }

          // findMany, findFirst*, updateMany, deleteMany, count, aggregate, groupBy,
          // updateManyAndReturn — all accept `where`. Injecting here also makes an
          // unscoped bulk deleteMany/updateMany impossible.
          return query({
            ...a,
            where: { ...(a.where ?? {}), organizationId },
          });
        },
      },
    },
  });
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user?.email) {
    throw new UnauthorizedError();
  }
  return { id: user.id, email: user.email, name: user.name ?? null };
}

/** MVP: exactly one organization per user (auto-created on signup). */
export const getActiveMembership = cache(async (userId: string) => {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    include: { organization: true },
  });
  if (!membership) {
    throw new ForbiddenError("No organization membership");
  }
  return membership;
});

export async function requireOrg() {
  const user = await requireUser();
  const membership = await getActiveMembership(user.id);
  return {
    user,
    organizationId: membership.organizationId,
    organization: membership.organization,
    membership,
  };
}

/** Primary entry point for services: `{ user, organizationId, organization, db }`. */
export async function tenantDb() {
  const ctx = await requireOrg();
  return { ...ctx, db: createTenantClient(ctx.organizationId) };
}
