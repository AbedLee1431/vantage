import { prisma } from "../db/client";
import type { SubscriptionStatus, UsageAction } from "@/generated/client";
import { getPlan, getPlans, type UsageActionKey } from "@/lib/billing/plans";

/**
 * Billing persistence owned by `src/server/db` (R2: base client lives here).
 * Tenant-scoped callers go through `src/server/billing/subscriptions.ts`;
 * the webhook (no session) resolves orgs from Stripe IDs here.
 */

export type SubscriptionRow = {
  id: string;
  organizationId: string;
  planCode: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
};

export async function getSubscriptionByOrg(
  organizationId: string,
): Promise<SubscriptionRow | null> {
  return (await prisma.subscription.findUnique({
    where: { organizationId },
  })) as SubscriptionRow | null;
}

export async function ensureFreeSubscription(organizationId: string): Promise<SubscriptionRow> {
  const existing = await getSubscriptionByOrg(organizationId);
  if (existing) return existing;
  return (await prisma.subscription.create({
    data: { organizationId, planCode: "free", status: "active" },
  })) as SubscriptionRow;
}

export async function findOrgByCustomerId(stripeCustomerId: string): Promise<string | null> {
  const row = await prisma.subscription.findUnique({ where: { stripeCustomerId } });
  return row?.organizationId ?? null;
}

/** Checkout context (org name + owner email) without leaking base client imports. */
export async function getCheckoutContext(organizationId: string): Promise<{
  organizationName: string;
  customerEmail: string;
}> {
  const [org, user] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.user.findFirst({
      where: { memberships: { some: { organizationId } } },
      orderBy: { createdAt: "asc" },
      select: { email: true },
    }),
  ]);
  return { organizationName: org?.name ?? "Workspace", customerEmail: user?.email ?? "" };
}

/** Persist a newly created Stripe customer before the webhook arrives. */
export async function attachStripeCustomer(
  organizationId: string,
  stripeCustomerId: string,
): Promise<void> {
  await prisma.subscription.update({
    where: { organizationId },
    data: { stripeCustomerId },
  });
}

export async function upsertSubscriptionFromStripe(input: {
  organizationId: string;
  planCode: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
}): Promise<SubscriptionRow> {
  const existing = await getSubscriptionByOrg(input.organizationId);
  if (!existing) {
    return (await prisma.subscription.create({ data: input })) as SubscriptionRow;
  }
  return (await prisma.subscription.update({
    where: { organizationId: input.organizationId },
    data: {
      planCode: input.planCode,
      stripeCustomerId: input.stripeCustomerId ?? existing.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      canceledAt: input.canceledAt,
      trialEndsAt: input.trialEndsAt,
    },
  })) as SubscriptionRow;
}

/** Downgrade path: Stripe deleted/expired → FREE, keep customer for history. */
export async function revertToFree(organizationId: string): Promise<SubscriptionRow> {
  const existing = await getSubscriptionByOrg(organizationId);
  if (!existing) return ensureFreeSubscription(organizationId);
  return (await prisma.subscription.update({
    where: { organizationId },
    data: {
      planCode: "free",
      stripeSubscriptionId: null,
      status: "active",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
    },
  })) as SubscriptionRow;
}

// ── Usage counters (period-keyed → automatic monthly reset) ─────────────────

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getUsage(
  organizationId: string,
  period: string = currentPeriod(),
): Promise<Record<UsageActionKey, number>> {
  const rows = await prisma.usageRecord.findMany({ where: { organizationId, period } });
  const out: Record<UsageActionKey, number> = {
    search: 0,
    ai_analysis: 0,
    competitor_analysis: 0,
    report_generation: 0,
  };
  for (const r of rows) {
    if (r.action in out) out[r.action as UsageActionKey] = r.count;
  }
  return out;
}

export async function incrementUsage(
  organizationId: string,
  action: UsageAction,
  period: string = currentPeriod(),
): Promise<number> {
  const existing = await prisma.usageRecord.findUnique({
    where: { organizationId_action_period: { organizationId, action, period } },
  });
  if (!existing) {
    const created = await prisma.usageRecord.create({
      data: { organizationId, action, period, count: 1 },
    });
    return created.count;
  }
  const updated = await prisma.usageRecord.update({
    where: { id: existing.id },
    data: { count: { increment: 1 } },
  });
  return updated.count;
}

// ── Webhook idempotency ledger ──────────────────────────────────────────────

export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  const row = await prisma.stripeWebhookEvent.findUnique({ where: { id: eventId } });
  return row !== null;
}

export async function markWebhookProcessed(eventId: string, type: string): Promise<void> {
  await prisma.stripeWebhookEvent.upsert({
    where: { id: eventId },
    create: { id: eventId, type },
    update: {},
  });
}

// ── Plan helpers (pure, shared) ─────────────────────────────────────────────

export function planExists(code: string): boolean {
  return getPlans().some((p) => p.code === code);
}

export function planPriceId(code: string): string | null {
  return getPlan(code)?.stripePriceId ?? null;
}
