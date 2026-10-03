import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/layout/marketing";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { formatPrice, getPlans } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  const plans = getPlans();
  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-brand-950">Simple plans</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">
            Free for exploration. Pro for heavier research. Usage resets monthly.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.code}>
              <CardContent>
                <CardTitle>
                  {p.name} · {formatPrice(p.priceCents)}
                </CardTitle>
                <CardDescription>{p.tagline}</CardDescription>
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className="mt-2 text-xs tabular-nums text-slate-500">
                  {p.limits.ai_analysis} AI analyses · {p.limits.competitor_analysis} competitor
                  analyses · {p.limits.report_generation} reports / month · up to{" "}
                  {p.limits.maxTrackedCompetitors} tracked competitors
                </div>
                <div className="mt-5">
                  {p.code === "free" ? (
                    <Link href="/register" className={buttonClasses({ variant: "secondary" })}>
                      Start free
                    </Link>
                  ) : (
                    <Link href="/billing" className={buttonClasses()}>
                      Upgrade in app
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
          Subscriptions are handled by Stripe (test mode in development). Cancel anytime in the
          customer portal — Pro stays active until the period ends, then returns to Free.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
