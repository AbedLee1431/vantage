import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import { formatPrice, getPlan, getPlans } from "@/lib/billing/plans";
import {
  BillingNotConfiguredError,
  DemoBillingProvider,
  StripeBillingProvider,
  getBillingStatus,
} from "@/server/billing/provider";
import {
  currentPeriod,
  ensureFreeSubscription,
  getSubscriptionByOrg,
  getUsage,
  incrementUsage,
} from "@/server/db/billing";
import {
  checkTrackedCompetitorLimit,
  checkUsageLimit,
  getEntitlements,
  handleBillingWebhook,
  OverQuotaError,
  recordUsage,
  requireUsageQuota,
} from "@/server/billing/subscriptions";
import { GET as plansGet } from "@/app/api/plans/route";
import { GET as subscriptionGet } from "@/app/api/billing/subscription/route";
import { POST as checkoutPost } from "@/app/api/billing/checkout/route";
import { POST as portalPost } from "@/app/api/billing/portal/route";
import { POST as webhookPost } from "@/app/api/webhooks/stripe/route";
import { POST as reportsPost } from "@/app/api/reports/route";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

const mockAuth = auth as unknown as {
  mockResolvedValue: (
    session: { user: { id: string; email: string; name: string | null }; expires: string } | null,
  ) => void;
};

function sessionFor(user: { id: string; email: string; name: string | null }) {
  mockAuth.mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

function postJson(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// Stripe env keys are intentionally UNSET in this repo; tests that need a
// "configured" provider set dummy values and restore them afterwards.
const ENV_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PRO"] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  vi.restoreAllMocks();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe("plan catalog (centralized, no secrets leak)", () => {
  it("defines FREE and PRO with positive limits", () => {
    const plans = getPlans();
    expect(plans.map((p) => p.code)).toEqual(["free", "pro"]);
    const free = getPlan("free")!;
    const pro = getPlan("pro")!;
    expect(free.priceCents).toBe(0);
    expect(pro.priceCents).toBeGreaterThan(0);
    for (const p of [free, pro]) {
      expect(p.limits.search).toBeGreaterThan(0);
      expect(p.limits.ai_analysis).toBeGreaterThan(0);
      expect(p.limits.maxTrackedCompetitors).toBeGreaterThan(0);
    }
    expect(pro.limits.ai_analysis).toBeGreaterThan(free.limits.ai_analysis);
    expect(getPlan("nope")).toBeNull();
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(2900)).toMatch(/\$29/);
  });

  it("GET /api/plans exposes no Stripe price IDs", async () => {
    process.env.STRIPE_PRICE_PRO = "price_test_123";
    const res = await plansGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plans: Record<string, unknown>[] };
    expect(body.plans).toHaveLength(2);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("price_test_123");
    expect(raw).not.toContain("sk_test");
  });
});

describe("demo billing mode (no Stripe keys)", () => {
  it("reports unconfigured and refuses to fabricate payments", async () => {
    expect(getBillingStatus()).toEqual({ configured: false, provider: "demo" });
    const demo = new DemoBillingProvider();
    expect(demo.isConfigured()).toBe(false);
    await expect(
      demo.createCheckoutSession({
        organizationId: "org_x",
        organizationName: "X",
        customerEmail: "x@example.com",
        planCode: "pro",
        priceId: "price_x",
        successUrl: "http://x/s",
        cancelUrl: "http://x/c",
      }),
    ).rejects.toBeInstanceOf(BillingNotConfiguredError);
    await expect(demo.createPortalSession("cus_x", "http://x")).rejects.toBeInstanceOf(
      BillingNotConfiguredError,
    );
    expect(() => demo.verifyWebhook("{}", null)).toThrow(BillingNotConfiguredError);
    expect(new StripeBillingProvider().isConfigured()).toBe(false);
  });

  it("subscription endpoint reports demo billing for a fresh org", async () => {
    const { user, organization } = await createTestOrg("BillDemo");
    try {
      sessionFor(user);
      const res = await subscriptionGet();
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        subscription: { planCode: string };
        billingConfigured: boolean;
        provider: string;
      };
      expect(body.subscription.planCode).toBe("free");
      expect(body.billingConfigured).toBe(false);
      expect(body.provider).toBe("demo");
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("checkout for PRO without price configuration returns 503 (never a fake URL)", async () => {
    const { user, organization } = await createTestOrg("Bill503");
    try {
      sessionFor(user);
      const res = await checkoutPost(
        postJson("http://x/api/billing/checkout", { planCode: "pro" }),
      );
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("not_configured");
      // No subscription mutation happened.
      expect((await getSubscriptionByOrg(organization.id))?.stripeCustomerId ?? null).toBeNull();
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("portal without a customer returns 404", async () => {
    const { user, organization } = await createTestOrg("BillPortal404");
    try {
      sessionFor(user);
      const res = await portalPost();
      expect(res.status).toBe(404);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("checkout validation + tenant isolation", () => {
  it("rejects unauthenticated, unknown, and free plans", async () => {
    mockAuth.mockResolvedValue(null);
    expect(
      (await checkoutPost(postJson("http://x/api/billing/checkout", { planCode: "pro" }))).status,
    ).toBe(401);

    const { user, organization } = await createTestOrg("BillVal");
    try {
      sessionFor(user);
      expect(
        (await checkoutPost(postJson("http://x/api/billing/checkout", { planCode: "spaceship" })))
          .status,
      ).toBe(400);
      expect(
        (await checkoutPost(postJson("http://x/api/billing/checkout", { planCode: "free" })))
          .status,
      ).toBe(400);
      expect((await checkoutPost(postJson("http://x/api/billing/checkout", {}))).status).toBe(400);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("creates checkout server-side with the configured price; ignores client org", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_PRICE_PRO = "price_test_pro";
    const a = await createTestOrg("BillCk A");
    const b = await createTestOrg("BillCk B");
    const spy = vi
      .spyOn(StripeBillingProvider.prototype, "createCheckoutSession")
      .mockResolvedValue({
        url: "https://checkout.stripe.test/s/1",
        customerId: "cus_A1",
        customerCreated: true,
      });
    try {
      sessionFor(a.user);
      const res = await checkoutPost(
        postJson("http://x/api/billing/checkout", {
          planCode: "pro",
          organizationId: b.organization.id, // untrusted — must be ignored
          price: "price_tampered",
        }),
      );
      expect(res.status).toBe(200);
      expect(((await res.json()) as { checkoutUrl: string }).checkoutUrl).toContain(
        "checkout.stripe.test",
      );
      // Server picked the configured price, not client input.
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0]![0]).toMatchObject({
        organizationId: a.organization.id,
        planCode: "pro",
        priceId: "price_test_pro",
      });
      // Customer persisted on the SESSION org only (duplicate prevention basis).
      expect((await getSubscriptionByOrg(a.organization.id))?.stripeCustomerId).toBe("cus_A1");
      expect(await getSubscriptionByOrg(b.organization.id)).toBeNull();
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });

  it("reuses the existing customer instead of duplicating", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_PRICE_PRO = "price_test_pro";
    const { user, organization } = await createTestOrg("BillReuse");
    const spy = vi
      .spyOn(StripeBillingProvider.prototype, "createCheckoutSession")
      .mockResolvedValue({
        url: "https://checkout.stripe.test/s/2",
        customerId: "cus_existing",
        customerCreated: false,
      });
    try {
      await ensureFreeSubscription(organization.id);
      await prisma.subscription.update({
        where: { organizationId: organization.id },
        data: { stripeCustomerId: "cus_existing" },
      });
      sessionFor(user);
      const res = await checkoutPost(
        postJson("http://x/api/billing/checkout", { planCode: "pro" }),
      );
      expect(res.status).toBe(200);
      expect(spy.mock.calls[0]![0]).toMatchObject({ existingCustomerId: "cus_existing" });
      const customers = await prisma.subscription.findMany({
        where: { stripeCustomerId: "cus_existing" },
      });
      expect(customers).toHaveLength(1);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("refuses a second checkout while PRO is active", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_PRICE_PRO = "price_test_pro";
    const { user, organization } = await createTestOrg("BillDup");
    try {
      await prisma.subscription.create({
        data: { organizationId: organization.id, planCode: "pro", status: "active" },
      });
      sessionFor(user);
      const res = await checkoutPost(
        postJson("http://x/api/billing/checkout", { planCode: "pro" }),
      );
      expect(res.status).toBe(409);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("portal returns a server-created URL for a customer", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    const { user, organization } = await createTestOrg("BillPortal");
    const spy = vi
      .spyOn(StripeBillingProvider.prototype, "createPortalSession")
      .mockResolvedValue({ url: "https://billing.stripe.test/p/1" });
    try {
      await prisma.subscription.create({
        data: {
          organizationId: organization.id,
          planCode: "pro",
          status: "active",
          stripeCustomerId: "cus_P1",
        },
      });
      sessionFor(user);
      const res = await portalPost();
      expect(res.status).toBe(200);
      expect(((await res.json()) as { portalUrl: string }).portalUrl).toContain(
        "billing.stripe.test",
      );
      expect(spy).toHaveBeenCalledWith("cus_P1", expect.stringContaining("/billing"));
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("entitlements + lifecycle policy", () => {
  it("fresh orgs get FREE entitlements", async () => {
    const { user, organization } = await createTestOrg("BillEnt");
    try {
      const ent = await getEntitlements(organization.id);
      expect(ent.planCode).toBe("free");
      expect(ent.isPro).toBe(false);
      expect(ent.needsAttention).toBe(false);
      expect(ent.period).toMatch(/^\d{4}-\d{2}$/);
      expect(ent.period).toBe(currentPeriod());
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("active/trialing PRO unlocks; past_due keeps access with attention; canceled reverts to FREE", async () => {
    const { user, organization } = await createTestOrg("BillLife");
    try {
      await prisma.subscription.create({
        data: { organizationId: organization.id, planCode: "pro", status: "active" },
      });
      let ent = await getEntitlements(organization.id);
      expect(ent.isPro).toBe(true);
      expect(ent.needsAttention).toBe(false);

      await prisma.subscription.update({
        where: { organizationId: organization.id },
        data: { status: "past_due" },
      });
      ent = await getEntitlements(organization.id);
      expect(ent.isPro).toBe(true);
      expect(ent.needsAttention).toBe(true);

      await prisma.subscription.update({
        where: { organizationId: organization.id },
        data: { status: "canceled" },
      });
      ent = await getEntitlements(organization.id);
      expect(ent.planCode).toBe("free");
      expect(ent.isPro).toBe(false);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("cancel-at-period-end keeps PRO with attention until the webhook reverts", async () => {
    const { user, organization } = await createTestOrg("BillCancelEnd");
    try {
      await prisma.subscription.create({
        data: {
          organizationId: organization.id,
          planCode: "pro",
          status: "active",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(Date.now() + 7 * 86_400_000),
        },
      });
      const ent = await getEntitlements(organization.id);
      expect(ent.isPro).toBe(true);
      expect(ent.needsAttention).toBe(true);
      expect(ent.cancelAtPeriodEnd).toBe(true);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("usage limits (product quotas, distinct from rate limits)", () => {
  it("counts monthly usage and blocks over-quota with 429 semantics", async () => {
    const { user, organization } = await createTestOrg("BillUsage");
    try {
      const free = getPlan("free")!;
      expect(await getUsage(organization.id)).toMatchObject({ report_generation: 0 });
      await recordUsage(organization.id, "report_generation");
      expect((await getUsage(organization.id)).report_generation).toBe(1);

      for (let i = 1; i < free.limits.report_generation; i++) {
        await incrementUsage(organization.id, "report_generation");
      }
      const atLimit = await checkUsageLimit(organization.id, "report_generation");
      expect(atLimit).toMatchObject({ allowed: false, remaining: 0 });
      await expect(requireUsageQuota(organization.id, "report_generation")).rejects.toBeInstanceOf(
        OverQuotaError,
      );
      // Other meters are unaffected.
      expect(await checkUsageLimit(organization.id, "ai_analysis")).toMatchObject({
        allowed: true,
      });
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("reports route enforces quota server-side (429 + upgrade hint)", async () => {
    const { user, organization } = await createTestOrg("Bill429");
    try {
      sessionFor(user);
      const free = getPlan("free")!;
      for (let i = 0; i < free.limits.report_generation; i++) {
        await recordUsage(organization.id, "report_generation");
      }
      const res = await reportsPost(postJson("http://x/api/reports", { type: "trends" }));
      expect(res.status).toBe(429);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("over_quota");
      expect(body.error.message).toMatch(/billing/i);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("tracked-competitor entitlement compares live counts to plan max", async () => {
    const { user, organization } = await createTestOrg("BillTracked");
    try {
      const free = getPlan("free")!;
      const first = await checkTrackedCompetitorLimit(organization.id);
      expect(first).toMatchObject({
        allowed: true,
        limit: free.limits.maxTrackedCompetitors,
        used: 0,
      });
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("webhook handling (verified, idempotent, tenant-safe)", () => {
  const runTag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  function stripeEvent(id: string, type: string, object: unknown) {
    return { id: `${id}-${runTag}`, type, data: { object } };
  }

  async function cleanupEvents() {
    await prisma.stripeWebhookEvent.deleteMany({ where: { id: { endsWith: runTag } } });
  }

  it("checkout completion upgrades the right org only", async () => {
    const a = await createTestOrg("BillWh A");
    const b = await createTestOrg("BillWh B");
    try {
      const outcome = await handleBillingWebhook(
        stripeEvent("evt_ck_1", "checkout.session.completed", {
          metadata: { organizationId: a.organization.id },
          customer: "cus_wh_a",
          subscription: "sub_wh_a",
        }),
      );
      expect(outcome).toEqual({ outcome: "processed" });
      expect((await getSubscriptionByOrg(a.organization.id))?.planCode).toBe("pro");
      expect(await getSubscriptionByOrg(b.organization.id)).toBeNull();
      // Replay is a no-op.
      expect(
        await handleBillingWebhook(stripeEvent("evt_ck_1", "checkout.session.completed", {})),
      ).toEqual({
        outcome: "duplicate",
      });
    } finally {
      await cleanupEvents();
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });

  it("subscription updated syncs status/periods; deleted reverts to FREE", async () => {
    const { user, organization } = await createTestOrg("BillWhSub");
    try {
      await ensureFreeSubscription(organization.id);
      const start = Math.floor(Date.now() / 1000);
      await handleBillingWebhook(
        stripeEvent("evt_sub_1", "customer.subscription.updated", {
          id: "sub_1",
          status: "active",
          customer: "cus_1",
          metadata: { organizationId: organization.id },
          items: {
            data: [
              {
                price: { id: "price_x" },
                current_period_start: start,
                current_period_end: start + 2_592_000,
              },
            ],
          },
          cancel_at_period_end: false,
          canceled_at: null,
          trial_end: null,
        }),
      );
      const sub = (await getSubscriptionByOrg(organization.id))!;
      expect(sub.status).toBe("active");
      expect(sub.stripeSubscriptionId).toBe("sub_1");
      expect(sub.currentPeriodEnd?.getTime()).toBe((start + 2_592_000) * 1000);

      await handleBillingWebhook(
        stripeEvent("evt_sub_2", "customer.subscription.deleted", {
          id: "sub_1",
          customer: "cus_1",
          metadata: { organizationId: organization.id },
        }),
      );
      const reverted = (await getSubscriptionByOrg(organization.id))!;
      expect(reverted.planCode).toBe("free");
      expect(reverted.stripeSubscriptionId).toBeNull();
    } finally {
      await cleanupEvents();
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("payment failure marks past_due (grace) without destroying access", async () => {
    const { user, organization } = await createTestOrg("BillWhFail");
    try {
      await prisma.subscription.create({
        data: {
          organizationId: organization.id,
          planCode: "pro",
          status: "active",
          stripeCustomerId: "cus_fail",
          stripeSubscriptionId: "sub_fail",
        },
      });
      await handleBillingWebhook(
        stripeEvent("evt_inv_1", "invoice.payment_failed", {
          customer: "cus_fail",
          parent: { subscription_details: { subscription: "sub_fail" } },
        }),
      );
      expect((await getSubscriptionByOrg(organization.id))?.status).toBe("past_due");
      expect((await getEntitlements(organization.id)).isPro).toBe(true);
    } finally {
      await cleanupEvents();
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("unknown events are acknowledged safely; unresolvable events marked unresolved", async () => {
    try {
      expect(await handleBillingWebhook(stripeEvent("evt_unk_1", "coupon.created", {}))).toEqual({
        outcome: "ignored",
      });
      expect(
        await handleBillingWebhook(
          stripeEvent("evt_orphan_1", "customer.subscription.updated", { id: "sub_orphan" }),
        ),
      ).toEqual({ outcome: "unresolved" });
    } finally {
      await cleanupEvents();
    }
  });

  it("route rejects missing/invalid signatures and accepts a real signed event", async () => {
    const { user, organization } = await createTestOrg("BillWhRoute");
    try {
      const noSig = new NextRequest("http://x/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "evt_x", type: "coupon.created", data: { object: {} } }),
      });
      expect((await webhookPost(noSig)).status).toBe(400);

      const badSig = new NextRequest("http://x/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=bad" },
        body: JSON.stringify({ id: "evt_x", type: "coupon.created", data: { object: {} } }),
      });
      expect((await webhookPost(badSig)).status).toBe(400);

      // Real HMAC-signed event (offline — no Stripe API calls involved).
      process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const payload = JSON.stringify({
        id: `evt_route_1-${runTag}`,
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { organizationId: organization.id },
            customer: "cus_r",
            subscription: "sub_r",
          },
        },
      });
      const header = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: process.env.STRIPE_WEBHOOK_SECRET,
      });
      const signed = new NextRequest("http://x/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": header },
        body: payload,
      });
      const ok = await webhookPost(signed);
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as { outcome: string }).outcome).toBe("processed");
      expect((await getSubscriptionByOrg(organization.id))?.planCode).toBe("pro");

      // Replay over HTTP is also a no-op (200, duplicate).
      const replay = new NextRequest("http://x/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": header },
        body: payload,
      });
      const dup = await webhookPost(replay);
      expect(dup.status).toBe(200);
      expect(((await dup.json()) as { outcome: string }).outcome).toBe("duplicate");
    } finally {
      await cleanupEvents();
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("cross-tenant billing data never leaks via the subscription endpoint", async () => {
    const a = await createTestOrg("BillX A");
    const b = await createTestOrg("BillX B");
    try {
      await prisma.subscription.create({
        data: {
          organizationId: b.organization.id,
          planCode: "pro",
          status: "active",
          stripeCustomerId: "cus_secret_b",
        },
      });
      sessionFor(a.user);
      const res = await subscriptionGet();
      const body = (await res.json()) as {
        subscription: { planCode: string };
        entitlements: { usage: Record<string, number> };
      };
      expect(body.subscription.planCode).toBe("free");
      const raw = JSON.stringify(body);
      expect(raw).not.toContain("cus_secret_b");
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});
