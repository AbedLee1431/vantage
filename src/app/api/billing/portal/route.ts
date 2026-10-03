import { NextResponse } from "next/server";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { BillingNotConfiguredError, getBillingProvider } from "@/server/billing/provider";
import { getSubscriptionByOrg } from "@/server/db/billing";

/** Create a Stripe Customer Portal session (server-side; tenant-scoped). */
export async function POST() {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;

  const limited = await checkApiRateLimit(ctx.organizationId, "billing:portal", 10, 3_600_000);
  if (limited) return limited;

  const sub = await getSubscriptionByOrg(ctx.organizationId);
  if (!sub?.stripeCustomerId) {
    return apiError("not_found", "No billing customer yet — start a checkout first.", 404);
  }
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    const result = await getBillingProvider().createPortalSession(
      sub.stripeCustomerId,
      `${appUrl}/billing`,
    );
    return NextResponse.json({ portalUrl: result.url });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return apiError("not_configured", "Stripe billing is not configured.", 503);
    }
    throw error;
  }
}
