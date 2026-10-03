import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/api";
import { getBillingProvider } from "@/server/billing/provider";
import { handleBillingWebhook } from "@/server/billing/subscriptions";

/**
 * Stripe webhook (signature-verified, idempotent).
 * Uses the RAW body for verification — never `req.json()` first.
 * Unknown events ack 200 (safe); replays are no-ops via the event ledger.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return apiError("validation", "Unreadable webhook body.", 400);
  }
  if (!rawBody) return apiError("validation", "Empty webhook body.", 400);

  let parsed: { id: string; type: string; data: { object: unknown } };
  try {
    const result = getBillingProvider().verifyWebhook(rawBody, signature);
    parsed = {
      id: result.eventId,
      type: result.type,
      data: result.event.data as { object: unknown },
    };
  } catch {
    return apiError("unauthorized", "Invalid webhook signature.", 400);
  }

  const outcome = await handleBillingWebhook(parsed);
  return NextResponse.json({ received: true, outcome: outcome.outcome });
}
