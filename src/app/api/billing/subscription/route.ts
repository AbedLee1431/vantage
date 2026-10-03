import { NextResponse } from "next/server";
import { apiContext, isResponse } from "@/server/api";
import { getEntitlements } from "@/server/billing/subscriptions";
import { getSubscriptionByOrg, ensureFreeSubscription } from "@/server/db/billing";
import { getBillingStatus } from "@/server/billing/provider";

/** Current subscription + usage (session org; never client-supplied). */
export async function GET() {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;

  const subscription =
    (await getSubscriptionByOrg(ctx.organizationId)) ??
    (await ensureFreeSubscription(ctx.organizationId));
  const entitlements = await getEntitlements(ctx.organizationId);
  const billing = getBillingStatus();

  return NextResponse.json({
    subscription: {
      planCode: entitlements.planCode,
      planName: entitlements.planName,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
    },
    entitlements: {
      isPro: entitlements.isPro,
      needsAttention: entitlements.needsAttention,
      limits: entitlements.limits,
      usage: entitlements.usage,
      period: entitlements.period,
    },
    billingConfigured: billing.configured,
    provider: billing.provider,
  });
}
