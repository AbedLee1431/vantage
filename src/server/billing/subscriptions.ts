import type Stripe from "stripe";
import { createTenantClient, tenantDb } from "../db/tenant";
import {
  currentPeriod,
  ensureFreeSubscription,
  findOrgByCustomerId,
  getSubscriptionByOrg,
  getUsage,
  incrementUsage,
  isWebhookProcessed,
  markWebhookProcessed,
  revertToFree,
  upsertSubscriptionFromStripe,
  type SubscriptionRow,
} from "../db/billing";
import { getPlan, getPlans, type PlanLimits, type UsageActionKey } from "@/lib/billing/plans";
import type { SubscriptionStatus } from "@/generated/client";

/**
 * Entitlements + usage enforcement (Phase 8 §9–10).
 *
 * Centralized capability layer: `Subscription → Entitlements → checks`.
 * No `plan === "pro"`散 checks in routes — call `requireEntitlement` /
 * `checkUsageLimit` here.
 *
 * Lifecycle policy (documented in docs/Integrations.md):
 * - active, trialing → full PRO access.
 * - past_due, incomplete → PRO access retained (grace) + `needsAttention`
 *   flag; UI nudges to the Customer Portal.
 * - unpaid, incomplete_expired, canceled → treated as FREE (reverted by
 *   webhook; enforced here even if the webhook is delayed).
 */

export type Entitlements = {
  planCode: string;
  planName: string;
  isPro: boolean;
  /** Payment needs attention (past_due / incomplete) — keep access, nudge. */
  needsAttention: boolean;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
  usage: Record<UsageActionKey, number>;
  period: string;
};

const GRACE_STATUSES: SubscriptionStatus[] = ["past_due", "incomplete"];
const LOST_STATUSES: SubscriptionStatus[] = ["unpaid", "incomplete_expired", "canceled"];

export async function getEntitlements(organizationId: string): Promise<Entitlements> {
  const sub =
    (await getSubscriptionByOrg(organizationId)) ?? (await ensureFreeSubscription(organizationId));
  const period = currentPeriod();
  const usage = await getUsage(organizationId, period);

  const lost = sub.planCode === "pro" && LOST_STATUSES.includes(sub.status);
  const effectivePlan = lost ? "free" : sub.planCode;
  const plan = getPlan(effectivePlan) ?? getPlan("free")!;
  const isPro = effectivePlan === "pro" && !lost;
  const needsAttention =
    sub.planCode === "pro" && (GRACE_STATUSES.includes(sub.status) || sub.cancelAtPeriodEnd);

  return {
    planCode: effectivePlan,
    planName: plan.name,
    isPro,
    needsAttention,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    limits: plan.limits,
    usage,
    period,
  };
}

/** Usage-limit check (product quotas). Security rate limits stay separate. */
export async function checkUsageLimit(
  organizationId: string,
  action: UsageActionKey,
): Promise<
  { allowed: boolean; remaining: number; limit: number; used: number } | { error: string }
> {
  try {
    const ent = await getEntitlements(organizationId);
    const limit = ent.limits[action];
    const used = ent.usage[action] ?? 0;
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit, used };
  } catch {
    return { error: "unavailable" };
  }
}

export class OverQuotaError extends Error {
  readonly action: UsageActionKey;
  readonly limit: number;
  constructor(action: UsageActionKey, limit: number) {
    super(`Monthly ${action} limit reached (${limit}). Upgrade for more.`);
    this.name = "OverQuotaError";
    this.action = action;
    this.limit = limit;
  }
}

/** Enforce quota before a metered action; increments on success path. */
export async function requireUsageQuota(
  organizationId: string,
  action: UsageActionKey,
): Promise<void> {
  const checked = await checkUsageLimit(organizationId, action);
  if ("error" in checked) throw new Error("Usage check unavailable.");
  if (!checked.allowed) throw new OverQuotaError(action, checked.limit);
}

export async function recordUsage(organizationId: string, action: UsageActionKey): Promise<number> {
  return incrementUsage(
    organizationId,
    action as "search" | "ai_analysis" | "competitor_analysis" | "report_generation",
  );
}

/** Tracked-competitor entitlement (live count vs plan max). */
export async function checkTrackedCompetitorLimit(organizationId: string): Promise<{
  allowed: boolean;
  limit: number;
  used: number;
}> {
  const ent = await getEntitlements(organizationId);
  const db = createTenantClient(organizationId);
  const used = await db.competitor.count();
  return {
    allowed: used < ent.limits.maxTrackedCompetitors,
    limit: ent.limits.maxTrackedCompetitors,
    used,
  };
}

// ── Webhook application ─────────────────────────────────────────────────────
// Idempotent: event IDs recorded before mutation; replays are no-ops.

function toDate(value: number | null | undefined): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000);
}

function planForPrice(priceId: string | null | undefined): string {
  if (!priceId) return "pro";
  const match = getPlans().find((p) => p.stripePriceId === priceId);
  return match?.code ?? "pro";
}

function stripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "paused":
      return "past_due";
    default:
      return "active";
  }
}

function str(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function num(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function customerIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const id = (value as Record<string, unknown>).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/** Period dates live on subscription items in the current Stripe API. */
function itemPeriod(subscription: Record<string, unknown>): {
  start: number | null;
  end: number | null;
  priceId: string | null;
} {
  const items = subscription.items as { data?: unknown[] } | undefined;
  const first = items?.data?.[0] as Record<string, unknown> | undefined;
  const price = first?.price as Record<string, unknown> | undefined;
  return {
    start: first ? num(first, "current_period_start") : null,
    end: first ? num(first, "current_period_end") : null,
    priceId: price ? str(price, "id") : null,
  };
}

export async function applyCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<{ organizationId: string } | null> {
  const record = session as unknown as Record<string, unknown>;
  const metadata = (record.metadata as Record<string, unknown> | null) ?? {};
  const organizationId = str(metadata, "organizationId");
  const customerId = customerIdOf(record.customer);
  const subValue = record.subscription;
  const subscriptionId =
    typeof subValue === "string"
      ? subValue
      : subValue && typeof subValue === "object"
        ? str(subValue as Record<string, unknown>, "id")
        : null;
  if (!organizationId) return null;

  const existing = await getSubscriptionByOrg(organizationId);
  await upsertSubscriptionFromStripe({
    organizationId,
    planCode: "pro",
    stripeCustomerId: customerId ?? existing?.stripeCustomerId ?? null,
    stripeSubscriptionId: subscriptionId ?? existing?.stripeSubscriptionId ?? null,
    status: subscriptionId ? "active" : (existing?.status ?? "active"),
    currentPeriodStart: existing?.currentPeriodStart ?? null,
    currentPeriodEnd: existing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: existing?.cancelAtPeriodEnd ?? false,
    canceledAt: null,
    trialEndsAt: existing?.trialEndsAt ?? null,
  });
  return { organizationId };
}

export async function applySubscriptionEvent(
  subscription: Stripe.Subscription,
): Promise<{ organizationId: string } | null> {
  const record = subscription as unknown as Record<string, unknown>;
  const metadata = (record.metadata as Record<string, unknown> | null) ?? {};
  const organizationId = str(metadata, "organizationId");
  const customerId = customerIdOf(record.customer);

  let resolvedOrg = organizationId;
  if (!resolvedOrg && customerId) {
    resolvedOrg = (await findOrgByCustomerId(customerId)) ?? null;
  }
  if (!resolvedOrg) return null;

  const { start, end, priceId } = itemPeriod(record);
  // Fallback for older API shapes that still carry top-level period fields.
  const startFallback = num(record, "current_period_start");
  const endFallback = num(record, "current_period_end");
  const status = stripeStatus(str(record, "status") as Stripe.Subscription.Status);
  if (status === "canceled") {
    await revertToFree(resolvedOrg);
    return { organizationId: resolvedOrg };
  }
  const id = str(record, "id");
  if (!id) return null;
  await upsertSubscriptionFromStripe({
    organizationId: resolvedOrg,
    planCode: planForPrice(priceId),
    stripeCustomerId: customerId,
    stripeSubscriptionId: id,
    status,
    currentPeriodStart: toDate(start ?? startFallback),
    currentPeriodEnd: toDate(end ?? endFallback),
    cancelAtPeriodEnd: (record.cancel_at_period_end as boolean | undefined) ?? false,
    canceledAt: toDate(num(record, "canceled_at")),
    trialEndsAt: toDate(num(record, "trial_end")),
  });
  return { organizationId: resolvedOrg };
}

export async function applyInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<{ organizationId: string } | null> {
  const record = invoice as unknown as Record<string, unknown>;
  const customerId = customerIdOf(record.customer);
  // Current API nests the subscription under parent.subscription_details.
  const parent = record.parent as Record<string, unknown> | null;
  const subDetails = parent?.subscription_details as Record<string, unknown> | null;
  const subscriptionRef = subDetails?.subscription ?? record.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef && typeof subscriptionRef === "object"
        ? str(subscriptionRef as Record<string, unknown>, "id")
        : null;
  if (!customerId && !subscriptionId) return null;
  const orgId = customerId ? await findOrgByCustomerId(customerId) : null;
  if (!orgId) return null;
  const existing = await getSubscriptionByOrg(orgId);
  if (!existing) return null;
  await upsertSubscriptionFromStripe({
    organizationId: orgId,
    planCode: existing.planCode === "free" ? "free" : "pro",
    stripeCustomerId: existing.stripeCustomerId,
    stripeSubscriptionId: existing.stripeSubscriptionId,
    status: "past_due",
    currentPeriodStart: existing.currentPeriodStart,
    currentPeriodEnd: existing.currentPeriodEnd,
    cancelAtPeriodEnd: existing.cancelAtPeriodEnd,
    canceledAt: existing.canceledAt,
    trialEndsAt: existing.trialEndsAt,
  });
  return { organizationId: orgId };
}

export async function applySubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<{ organizationId: string } | null> {
  const record = subscription as unknown as Record<string, unknown>;
  const metadata = (record.metadata as Record<string, unknown> | null) ?? {};
  const customerId = customerIdOf(record.customer);
  const orgId =
    str(metadata, "organizationId") ?? (customerId ? await findOrgByCustomerId(customerId) : null);
  if (!orgId) return null;
  await revertToFree(orgId);
  return { organizationId: orgId };
}

/** Route-level dispatcher with idempotency guard. Returns "handled" semantics. */
export async function handleBillingWebhook(event: {
  id: string;
  type: string;
  data: { object: unknown };
}): Promise<{ outcome: "processed" | "duplicate" | "ignored" | "unresolved" }> {
  if (await isWebhookProcessed(event.id)) return { outcome: "duplicate" };
  const type = event.type;
  let resolved: { organizationId: string } | null = null;

  if (type === "checkout.session.completed") {
    resolved = await applyCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  } else if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
    resolved = await applySubscriptionEvent(event.data.object as Stripe.Subscription);
  } else if (type === "customer.subscription.deleted") {
    resolved = await applySubscriptionDeleted(event.data.object as Stripe.Subscription);
  } else if (type === "invoice.payment_failed" || type === "invoice.payment_action_required") {
    resolved = await applyInvoicePaymentFailed(event.data.object as Stripe.Invoice);
  } else {
    await markWebhookProcessed(event.id, type);
    return { outcome: "ignored" };
  }

  await markWebhookProcessed(event.id, type);
  return { outcome: resolved ? "processed" : "unresolved" };
}

/** Billing summary for pages (session-derived org, never client input). */
export async function getBillingSummary(): Promise<{
  subscription: SubscriptionRow;
  entitlements: Entitlements;
  billingConfigured: boolean;
}> {
  const { organizationId } = await tenantDb();
  const subscription =
    (await getSubscriptionByOrg(organizationId)) ?? (await ensureFreeSubscription(organizationId));
  const entitlements = await getEntitlements(organizationId);
  const { getBillingStatus } = await import("./provider");
  return { subscription, entitlements, billingConfigured: getBillingStatus().configured };
}

export { getPlans };
export type { SubscriptionRow };
export { tenantDb };
