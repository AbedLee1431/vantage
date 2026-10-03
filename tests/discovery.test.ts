import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import {
  getFilterOptions,
  getProduct,
  getStore,
  getTrends,
  globalSearch,
  listProducts,
  listStores,
} from "@/modules/discovery/queries";
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

async function seededOrg(name: string) {
  const { user, organization } = await createTestOrg(name);
  await buildDemoDataset(organization.id);
  return { user, organization };
}

function sessionFor(user: { id: string; email: string; name: string | null }) {
  mockAuth.mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

describe("product discovery", () => {
  it("lists, searches, filters, sorts, and paginates within the org", async () => {
    const { user, organization } = await seededOrg("Disc A");
    try {
      sessionFor(user);

      const all = await listProducts({});
      expect(all.total).toBe(7);
      expect(all.items).toHaveLength(7);
      expect(all.totalPages).toBe(1);

      const jacket = await listProducts({ q: "jacket" });
      expect(jacket.total).toBe(1);
      expect(jacket.items[0]?.name).toBe("Trailhead Insulated Jacket");

      const jackets = await listProducts({ category: "Jackets" });
      expect(jackets.total).toBe(1);

      const cheap = await listProducts({ maxPrice: 30 });
      expect(cheap.total).toBe(1);
      expect(cheap.items[0]?.name).toBe("Gentle Oat Cleanser");

      const byPrice = await listProducts({ sort: "price-asc" });
      const prices = byPrice.items.map((p) => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));

      const byName = await listProducts({ sort: "name" });
      const names = byName.items.map((p) => p.name);
      expect(names).toEqual([...names].sort());

      const page2 = await listProducts({ page: 2, pageSize: 3 });
      expect(page2.items).toHaveLength(3);
      expect(page2.totalPages).toBe(3);
      expect(page2.page).toBe(2);

      // hostile input falls back to defaults (never errors, never unscoped)
      const hostile = await listProducts({ sort: "evil", page: -5, pageSize: 9999 });
      expect(hostile.total).toBe(7);
      expect(hostile.page).toBe(1);

      // every row labeled demo
      expect(new Set(all.items.map((p) => p.provenance))).toEqual(new Set(["demo"]));
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("never leaks another organization's products", async () => {
    const a = await seededOrg("Leak A");
    const b = await seededOrg("Leak B");
    try {
      sessionFor(a.user);
      const list = await listProducts({});
      expect(list.total).toBe(7); // not 14
      const bIds = new Set(
        (
          await prisma.product.findMany({
            where: { organizationId: b.organization.id },
            select: { id: true },
          })
        ).map((p) => p.id),
      );
      for (const item of list.items) {
        expect(bIds.has(item.id)).toBe(false);
      }
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });

  it("getProduct returns full detail, null for missing/cross-org ids", async () => {
    const a = await seededOrg("Detail A");
    const b = await seededOrg("Detail B");
    try {
      sessionFor(a.user);
      const jacket = await prisma.product.findFirst({
        where: { organizationId: a.organization.id, name: { contains: "Jacket" } },
      });
      const detail = await getProduct(jacket!.id);
      expect(detail?.name).toBe("Trailhead Insulated Jacket");
      expect(detail?.store.name).toBe("Nordwind Outdoors");
      expect(detail?.reviewCount).toBe(2);
      expect(detail?.storeAdCount).toBeGreaterThan(0);

      expect(await getProduct("c".repeat(25))).toBeNull();
      const bProduct = await prisma.product.findFirst({
        where: { organizationId: b.organization.id },
      });
      expect(await getProduct(bProduct!.id)).toBeNull();
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("store discovery", () => {
  it("lists, searches, filters, and sorts stores", async () => {
    const { user, organization } = await seededOrg("Stores A");
    try {
      sessionFor(user);
      const all = await listStores({});
      expect(all.total).toBe(3);

      const q = await listStores({ q: "lumen" });
      expect(q.total).toBe(1);
      expect(q.items[0]?.name).toBe("Lumen Skincare");

      const byCountry = await listStores({ country: "GB" });
      expect(byCountry.total).toBe(1);

      const byPlatform = await listStores({ platform: "Shopify" });
      expect(byPlatform.total).toBe(2);

      const byProducts = await listStores({ sort: "products" });
      expect(byProducts.items[0]?.productCount).toBe(3); // Nordwind has 3

      expect(new Set(all.items.map((s) => s.provenance))).toEqual(new Set(["demo"]));
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("getStore returns overview + products + counts, null when out of scope", async () => {
    const a = await seededOrg("Profile A");
    const b = await seededOrg("Profile B");
    try {
      sessionFor(a.user);
      const nordwind = await prisma.store.findFirst({
        where: { organizationId: a.organization.id, name: { contains: "Nordwind" } },
      });
      const profile = await getStore(nordwind!.id);
      expect(profile?.name).toBe("Nordwind Outdoors");
      expect(profile?.products).toHaveLength(3);
      expect(profile?.productCount).toBe(3);
      expect(profile?.adCount).toBeGreaterThan(0);

      expect(await getStore("c".repeat(25))).toBeNull();
      const bStore = await prisma.store.findFirst({ where: { organizationId: b.organization.id } });
      expect(await getStore(bStore!.id)).toBeNull();
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("global search", () => {
  it("groups matches by type and stays in-org", async () => {
    const a = await seededOrg("Search A");
    const b = await seededOrg("Search B");
    try {
      sessionFor(a.user);
      // "nordwind" matches the store + its advertisers (own fields only — products
      // don't contain the term, so correctly no product hits)
      const { results } = await globalSearch({ q: "nordwind" });
      const types = new Set(results.map((r) => r.type));
      expect(types.has("store")).toBe(true);
      expect(types.has("advertiser")).toBe(true);
      expect(types.has("product")).toBe(false);

      const jackets = await globalSearch({ q: "jacket" });
      const jacketHit = jackets.results.find((r) => r.type === "product");
      expect(jacketHit).toBeDefined();
      const jacketRow = await prisma.product.findUnique({ where: { id: jacketHit!.id } });
      expect(jacketRow?.organizationId).toBe(a.organization.id);
      // every result id belongs to A
      for (const r of results) {
        if (r.type === "product") {
          const row = await prisma.product.findUnique({ where: { id: r.id } });
          expect(row?.organizationId).toBe(a.organization.id);
        }
        if (r.type === "store") {
          const row = await prisma.store.findUnique({ where: { id: r.id } });
          expect(row?.organizationId).toBe(a.organization.id);
        }
      }

      const empty = await globalSearch({ q: "" });
      expect(empty.results).toEqual([]);
      const nonsense = await globalSearch({ q: "zzz-no-such-thing-zzz" });
      expect(nonsense.results).toEqual([]);
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("trends", () => {
  it("computes labeled buckets and explanations from observed rows", async () => {
    const { user, organization } = await seededOrg("Trends A");
    try {
      sessionFor(user);
      const trends = await getTrends();
      expect(trends.weeks).toBe(16);
      expect(trends.labels).toHaveLength(16);
      expect(trends.productBuckets).toHaveLength(16);
      expect(trends.adBuckets).toHaveLength(16);
      const bucketedProducts = trends.productBuckets.reduce((a, b) => a + b, 0);
      // all 7 seeded products fall inside the 16-week window (oldest is 200d? mug 200d > 112d window)
      expect(bucketedProducts).toBeLessThanOrEqual(7);
      expect(bucketedProducts).toBeGreaterThan(0);
      expect(trends.categories.length).toBeGreaterThan(0);
      expect(trends.summary.length).toBeGreaterThan(0);
      expect(trends.provenance).toBe("calculated");
      expect(trends.sourceProvenance).toBe("demo");
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("filter options", () => {
  it("returns distinct filter values", async () => {
    const { user, organization } = await seededOrg("Filters A");
    try {
      sessionFor(user);
      const opts = await getFilterOptions();
      expect(opts.productCategories.length).toBeGreaterThan(0);
      expect(opts.storeList).toHaveLength(3);
      expect(opts.countries).toContain("US");
      expect(opts.platforms).toContain("Shopify");
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});
