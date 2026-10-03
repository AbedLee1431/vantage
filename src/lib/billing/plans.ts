/**
 * Central plan configuration (FR-BILL-01, ADR-008/017).
 *
 * The single source of truth for plans, features, and usage limits. UI
 * (pricing page, billing page, dashboard) and server (entitlements, quotas)
 * both read from here — no Stripe price IDs or limits scattered in code.
 *
 * Stripe price IDs come from env (`STRIPE_PRICE_*`); limits below are MVP
 * defaults (monthly, calendar-month periods). FREE has no Stripe price —
 * it is the default with no checkout.
 */

export type UsageActionKey = "search" | "ai_analysis" | "competitor_analysis" | "report_generation";

export type PlanLimits = Record<UsageActionKey, number> & {
  /** Max tracked competitors (count-based entitlement, not a monthly counter). */
  maxTrackedCompetitors: number;
};

export type PlanDefinition = {
  code: string;
  name: string;
  tagline: string;
  /** Monthly price in USD cents for display; null = free. Stripe owns the charge. */
  priceCents: number | null;
  stripePriceId: string | null;
  cta: string;
  features: string[];
  limits: PlanLimits;
};

function envPrice(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function getPlans(): PlanDefinition[] {
  return [
    {
      code: "free",
      name: "Free",
      tagline: "Explore Vantage on demo data.",
      priceCents: 0,
      stripePriceId: null,
      cta: "Current plan",
      features: [
        "Product, store & ad discovery",
        "AI ad & competitor analysis (metered)",
        "Reports with CSV export",
        "Watchlists & change alerts",
      ],
      limits: {
        search: 200,
        ai_analysis: 10,
        competitor_analysis: 3,
        report_generation: 3,
        maxTrackedCompetitors: 3,
      },
    },
    {
      code: "pro",
      name: "Pro",
      tagline: "Heavier research for founders, marketers & agencies.",
      priceCents: 2900,
      stripePriceId: envPrice("STRIPE_PRICE_PRO"),
      cta: "Upgrade to Pro",
      features: [
        "Everything in Free",
        "500 AI analyses / month",
        "100 competitor analyses / month",
        "100 reports / month",
        "Up to 50 tracked competitors",
        "Priority job processing",
      ],
      limits: {
        search: 5000,
        ai_analysis: 500,
        competitor_analysis: 100,
        report_generation: 100,
        maxTrackedCompetitors: 50,
      },
    },
  ];
}

export function getPlan(code: string): PlanDefinition | null {
  return getPlans().find((p) => p.code === code) ?? null;
}

export function getDefaultPlan(): PlanDefinition {
  return getPlans()[0] as PlanDefinition;
}

export const USAGE_ACTION_LABELS: Record<UsageActionKey, string> = {
  search: "Searches",
  ai_analysis: "AI analyses",
  competitor_analysis: "Competitor analyses",
  report_generation: "Reports",
};

export function formatPrice(cents: number | null): string {
  if (cents == null) return "Custom";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/mo`;
}
