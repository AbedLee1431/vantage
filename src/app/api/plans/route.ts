import { NextResponse } from "next/server";
import { formatPrice, getPlans } from "@/lib/billing/plans";

/** Public plan catalog (centralized config; no secrets). */
export async function GET() {
  const plans = getPlans().map((p) => ({
    code: p.code,
    name: p.name,
    tagline: p.tagline,
    price: formatPrice(p.priceCents),
    priceCents: p.priceCents,
    cta: p.cta,
    features: p.features,
    limits: p.limits,
    // Never expose Stripe price IDs to the browser — checkout resolves them server-side.
  }));
  return NextResponse.json({ plans });
}
