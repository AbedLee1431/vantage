import Stripe from "stripe";

/**
 * Billing provider abstraction (Phase 8 §1, ADR-008/017).
 *
 * Application code talks to `BillingProvider`; only `StripeBillingProvider`
 * touches the Stripe SDK. `DemoBillingProvider` keeps the app fully usable
 * with no keys — it never fabricates payments (all methods report
 * "not configured").
 */

export type CheckoutInput = {
  organizationId: string;
  organizationName: string;
  customerEmail: string;
  planCode: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  existingCustomerId?: string | null;
};

export type CheckoutResult = {
  url: string;
  customerId: string;
  /** True when the customer row was newly created (caller persists it). */
  customerCreated: boolean;
};

export type WebhookParseResult = {
  eventId: string;
  type: string;
  /** Raw Stripe event for handlers (opaque to callers outside billing). */
  event: Stripe.Event;
};

export interface BillingProvider {
  readonly name: string;
  isConfigured(): boolean;
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult>;
  createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }>;
  verifyWebhook(rawBody: string, signature: string | null): WebhookParseResult;
}

function stripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(secret);
}

export class StripeBillingProvider implements BillingProvider {
  readonly name = "stripe";

  isConfigured(): boolean {
    return !!(
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_PRO
    );
  }

  /** Fully configured for live checkout (secret + target price). */
  isCheckoutConfigured(): boolean {
    return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO);
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const stripe = stripeClient();
    let customerId = input.existingCustomerId ?? null;
    let customerCreated = false;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: input.customerEmail,
        name: input.organizationName,
        metadata: { organizationId: input.organizationId },
      });
      customerId = customer.id;
      customerCreated = true;
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { organizationId: input.organizationId, planCode: input.planCode },
      subscription_data: { metadata: { organizationId: input.organizationId } },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url, customerId, customerCreated };
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  verifyWebhook(rawBody: string, signature: string | null): WebhookParseResult {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    if (!signature) throw new Error("Missing Stripe signature.");
    const stripe = stripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    return { eventId: event.id, type: event.type, event };
  }
}

/**
 * Demo provider — the app runs without Stripe keys (AGENTS.md rule 7).
 * Every mutating method throws a typed "not configured" error; the UI
 * renders an explicit "Stripe unavailable" state instead of fake billing.
 */
export class BillingNotConfiguredError extends Error {
  constructor(message = "Stripe billing is not configured.") {
    super(message);
    this.name = "BillingNotConfiguredError";
  }
}

export class DemoBillingProvider implements BillingProvider {
  readonly name = "demo";
  isConfigured(): boolean {
    return false;
  }
  async createCheckoutSession(_input: CheckoutInput): Promise<CheckoutResult> {
    void _input;
    throw new BillingNotConfiguredError();
  }
  async createPortalSession(_customerId: string, _returnUrl: string): Promise<{ url: string }> {
    void _customerId;
    void _returnUrl;
    throw new BillingNotConfiguredError();
  }
  verifyWebhook(_rawBody: string, _signature: string | null): WebhookParseResult {
    void _rawBody;
    void _signature;
    throw new BillingNotConfiguredError();
  }
}

/** Resolve the active provider: Stripe when a secret key exists, else Demo. */
export function getBillingProvider(): BillingProvider {
  if (process.env.STRIPE_SECRET_KEY) return new StripeBillingProvider();
  return new DemoBillingProvider();
}

export function getBillingStatus(): { configured: boolean; provider: string } {
  const provider = getBillingProvider();
  return {
    configured: provider.isConfigured(),
    provider: provider.name,
  };
}
