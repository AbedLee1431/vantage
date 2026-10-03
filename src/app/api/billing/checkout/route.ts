import { NextRequest, NextResponse } from "next/server";
import { checkoutRequestSchema } from "@/lib/validation";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { BillingNotConfiguredError, getBillingProvider } from "@/server/billing/provider";
import {
  attachStripeCustomer,
  ensureFreeSubscription,
  getCheckoutContext,
  getSubscriptionByOrg,
} from "@/server/db/billing";
import { getPlan } from "@/lib/billing/plans";

/**
 * Create a Stripe Checkout Session (server-side; the server picks the price).
 * FREE has no checkout — it is the default. Unknown plan codes → 400.
 * Stripe unconfigured → 503 with an explicit state (never a fake URL).
 */
export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;

  const limited = await checkApiRateLimit(ctx.organizationId, "billing:checkout", 10, 3_600_000);
  if (limited) return limited;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Invalid request.", 400);
  }
  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("validation", "Plan is required.", 400);

  const plan = getPlan(parsed.data.planCode);
  if (!plan) return apiError("validation", "Unknown plan.", 400);
  if (plan.code === "free") {
    return apiError("validation", "The Free plan needs no checkout.", 400);
  }
  const priceId = plan.stripePriceId;
  if (!priceId) {
    return apiError("not_configured", "Pro checkout is not configured yet.", 503);
  }

  const sub =
    (await getSubscriptionByOrg(ctx.organizationId)) ??
    (await ensureFreeSubscription(ctx.organizationId));
  if (sub.planCode === "pro" && (sub.status === "active" || sub.status === "trialing")) {
    return apiError("conflict", "Already subscribed to Pro.", 409);
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const provider = getBillingProvider();
  try {
    // Email for the Stripe customer row (identity lookup, never tenant data).
    const { organizationName, customerEmail } = await getCheckoutContext(ctx.organizationId);
    const result = await provider.createCheckoutSession({
      organizationId: ctx.organizationId,
      organizationName,
      customerEmail,
      planCode: plan.code,
      priceId,
      successUrl: `${appUrl}/billing?checkout=success`,
      cancelUrl: `${appUrl}/billing?checkout=canceled`,
      existingCustomerId: sub.stripeCustomerId,
    });
    // Persist a newly created customer immediately so portal works pre-webhook.
    if (result.customerCreated && result.customerId && !sub.stripeCustomerId) {
      await attachStripeCustomer(ctx.organizationId, result.customerId);
    }
    return NextResponse.json({ checkoutUrl: result.url });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return apiError("not_configured", "Stripe billing is not configured.", 503);
    }
    throw error;
  }
}
