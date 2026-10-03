import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import { computeInsights, painPoints } from "@/lib/reviews";
import type { ReviewInput } from "@/lib/reviews";
import { getReviewFilterOptions, getReviewInsights, listReviews } from "@/modules/reviews/queries";
import { buildDemoDataset } from "@/server/db/seed-data";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
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

const canned: ReviewInput[] = [
  {
    id: "r1",
    rating: 5,
    title: "Warm",
    body: "Great jacket for hiking trips.",
    date: new Date(),
    productName: "Jacket",
    storeName: null,
  },
  {
    id: "r2",
    rating: 2,
    title: "Slow shipping",
    body: "Delivery took weeks and tracking never updated.",
    date: new Date(),
    productName: "Jacket",
    storeName: null,
  },
  {
    id: "r3",
    rating: 2,
    title: "Pilling",
    body: "Fabric pilled after one wash, poor quality.",
    date: new Date(),
    productName: "Shirt",
    storeName: null,
  },
  {
    id: "r4",
    rating: 4,
    title: "Good, wish bigger",
    body: "Love it, wish it had more pockets please.",
    date: new Date(),
    productName: "Pack",
    storeName: null,
  },
  {
    id: "r5",
    rating: 5,
    title: "Worth it",
    body: "Expensive but worth the price for daily use.",
    date: new Date(),
    productName: "Mug",
    storeName: null,
  },
];

describe("insights computation (pure, deterministic)", () => {
  it("computes sentiment arithmetic", () => {
    const insights = computeInsights(canned);
    expect(insights.sentiment.count).toBe(5);
    expect(insights.sentiment.avg).toBeCloseTo(3.6);
    expect(insights.sentiment.positive).toBe(3);
    expect(insights.sentiment.neutral).toBe(0);
    expect(insights.sentiment.negative).toBe(2);
  });

  it("buckets themes from positive and negative reviews separately", () => {
    const insights = computeInsights(canned);
    expect(insights.negativeThemes.map((t) => t.theme)).toContain("shipping");
    expect(insights.negativeThemes.map((t) => t.theme)).toContain("quality");
    expect(insights.positiveThemes.length).toBeGreaterThanOrEqual(0);
  });

  it("detects feature requests and use contexts", () => {
    const insights = computeInsights(canned);
    expect(insights.featureRequests.length).toBe(1);
    expect(insights.featureRequests[0]?.theme).toBe("feature requests");
    expect(insights.useContexts.map((t) => t.theme)).toContain("hik");
  });

  it("handles empty input without inventing", () => {
    const insights = computeInsights([]);
    expect(insights.sentiment.count).toBe(0);
    expect(insights.sentiment.avg).toBeNull();
    expect(insights.positiveThemes).toEqual([]);
    expect(insights.negativeThemes).toEqual([]);
    expect(painPoints(insights)).toEqual([]);
  });

  it("painPoints returns negative themes by frequency", () => {
    const insights = computeInsights(canned);
    const pains = painPoints(insights);
    expect(pains.length).toBeGreaterThan(0);
    expect(pains[0]?.count).toBeGreaterThanOrEqual(pains[pains.length - 1]?.count ?? 0);
  });
});

describe("review queries (scoped, labeled)", () => {
  it("lists with rating, keyword, scope filters and sorts", async () => {
    const { user, organization } = await createTestOrg("Reviews A");
    await buildDemoDataset(organization.id);
    try {
      sessionFor(user);
      const all = await listReviews({});
      expect(all.total).toBe(8);
      expect(new Set(all.items.map((r) => r.provenance))).toEqual(new Set(["demo"]));

      expect((await listReviews({ rating: 5 })).total).toBe(4);
      expect((await listReviews({ q: "shipping" })).total).toBeGreaterThanOrEqual(1);
      const lowest = await listReviews({ sort: "lowest" });
      expect(lowest.items[0]?.rating).toBe(2);

      const jacket = await prisma.product.findFirst({
        where: { organizationId: organization.id, name: { contains: "Jacket" } },
      });
      const scoped = await listReviews({ productId: jacket!.id });
      expect(scoped.total).toBe(2);
      expect(scoped.items.every((r) => r.productId === jacket!.id)).toBe(true);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("never leaks another organization's reviews", async () => {
    const a = await createTestOrg("ReviewsLeak A");
    const b = await createTestOrg("ReviewsLeak B");
    await buildDemoDataset(a.organization.id);
    await buildDemoDataset(b.organization.id);
    try {
      sessionFor(a.user);
      const list = await listReviews({});
      expect(list.total).toBe(8);
      const bIds = new Set(
        (
          await prisma.review.findMany({
            where: { organizationId: b.organization.id },
            select: { id: true },
          })
        ).map((r) => r.id),
      );
      for (const item of list.items) {
        expect(bIds.has(item.id)).toBe(false);
      }
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });

  it("computes insights per scope with provenance", async () => {
    const { user, organization } = await createTestOrg("Insights A");
    await buildDemoDataset(organization.id);
    try {
      sessionFor(user);
      const org = await getReviewInsights({});
      expect(org.insights.sentiment.count).toBe(8);
      expect(org.provenance).toBe("calculated");
      expect(org.sourceProvenance).toBe("demo");

      const jacket = await prisma.product.findFirst({
        where: { organizationId: organization.id, name: { contains: "Jacket" } },
      });
      const scoped = await getReviewInsights({ productId: jacket!.id });
      expect(scoped.insights.sentiment.count).toBe(2);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("exposes filter options", async () => {
    const { user, organization } = await createTestOrg("ReviewOpts");
    await buildDemoDataset(organization.id);
    try {
      sessionFor(user);
      const opts = await getReviewFilterOptions();
      expect(opts.products.length).toBe(7);
      expect(opts.stores.length).toBe(3);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});
