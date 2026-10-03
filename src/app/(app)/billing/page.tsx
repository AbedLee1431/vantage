import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { UsageMeter } from "@/components/billing/usage-meter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { USAGE_ACTION_LABELS, formatPrice, getPlans } from "@/lib/billing/plans";
import { getBillingSummary } from "@/server/billing/subscriptions";
import { formatDate } from "@/lib/format";
import { CheckoutButton, PortalButton } from "./actions";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const checkout = params.checkout;
  const { subscription, entitlements, billingConfigured } = await getBillingSummary();
  const plans = getPlans();
  const pro = plans.find((p) => p.code === "pro")!;

  const statusLabel =
    entitlements.planCode === "free"
      ? "Free"
      : subscription.status === "active"
        ? "Active"
        : subscription.status === "trialing"
          ? "Trialing"
          : subscription.status === "past_due"
            ? "Past due"
            : subscription.status;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">Billing</h1>

      {checkout === "success" ? (
        <Card className="ring-emerald-600/20">
          <CardContent>
            <p className="text-sm font-medium text-emerald-800">
              Checkout completed. Your subscription activates once Stripe confirms payment — this
              page refreshes automatically via webhook.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {checkout === "canceled" ? (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-600">
              Checkout was canceled — no charge was made. You can retry whenever you like.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!billingConfigured ? (
        <Card className="ring-amber-600/20">
          <CardHeader>
            <CardTitle>Stripe billing is not configured</CardTitle>
            <CardDescription>
              Development/demo mode: the app is fully usable on the Free plan. No payments are
              processed and no fake charges are ever created. Set STRIPE_* keys to enable Pro
              checkout.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {entitlements.needsAttention ? (
        <Card className="ring-amber-600/20">
          <CardContent>
            <p className="text-sm font-medium text-amber-800">
              {subscription.cancelAtPeriodEnd
                ? `Cancellation scheduled — Pro stays active until ${subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "the period ends"}.`
                : "There is a problem with your payment. Pro access continues for now — please update payment details in the billing portal."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>
                {entitlements.planName} · renewals and invoices live in Stripe
              </CardDescription>
            </div>
            <Badge
              className={
                entitlements.isPro
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                  : "bg-slate-100 text-slate-600 ring-slate-500/20"
              }
            >
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>
              Plan: <strong className="text-slate-900">{entitlements.planName}</strong>
            </span>
            {subscription.currentPeriodEnd && entitlements.isPro ? (
              <span>
                {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}:{" "}
                <strong className="text-slate-900">
                  {formatDate(subscription.currentPeriodEnd)}
                </strong>
              </span>
            ) : null}
            <span>
              Period: <strong className="text-slate-900">{entitlements.period}</strong> (usage
              resets monthly)
            </span>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            {!entitlements.isPro && billingConfigured ? <CheckoutButton planCode="pro" /> : null}
            {!entitlements.isPro && !billingConfigured ? (
              <p className="text-sm text-slate-500">
                Pro checkout appears here once Stripe is configured. See{" "}
                <Link href="/pricing" className="font-medium text-accent-700 hover:underline">
                  pricing
                </Link>
                .
              </p>
            ) : null}
            {subscription.stripeCustomerId && billingConfigured ? <PortalButton /> : null}
          </div>
          {entitlements.isPro ? (
            <p className="text-xs text-slate-400">
              Plan changes and cancellation happen in the Stripe Customer Portal. Access updates
              after Stripe confirms — never from this page alone. Pro is{" "}
              {formatPrice(pro.priceCents)}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage this period ({entitlements.period})</CardTitle>
          <CardDescription>
            Monthly quotas reset on the 1st. Security rate limits (per-hour) are separate and not
            shown here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(USAGE_ACTION_LABELS) as (keyof typeof USAGE_ACTION_LABELS)[]).map(
            (action) => (
              <UsageMeter
                key={action}
                label={USAGE_ACTION_LABELS[action]}
                used={entitlements.usage[action] ?? 0}
                limit={entitlements.limits[action]}
              />
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <CardDescription>
            One central configuration drives pricing, checkout, and limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <div key={p.code} className="rounded-md p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-900">
                {p.name} · {formatPrice(p.priceCents)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
