import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import {
  getAd,
  getAdFilterOptions,
  getAdvertiser,
  listAds,
  listAdvertisers,
} from "@/modules/ads/queries";
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

describe("ad discovery", () => {
  it("lists with keyword, platform, format, advertiser, category, and store filters", async () => {
    const { user, organization } = await seededOrg("Ads A");
    try {
      sessionFor(user);

      const all = await listAds({});
      expect(all.total).toBe(6);
      expect(all.source).toBe("demo-seed");
      expect(new Set(all.items.map((a) => a.provenance))).toEqual(new Set(["demo"]));

      expect((await listAds({ q: "skincare" })).total).toBe(1);
      expect((await listAds({ platform: "Meta" })).total).toBe(4);
      expect((await listAds({ platform: "TikTok" })).total).toBe(1);
      expect((await listAds({ format: "video" })).total).toBe(3);
      expect((await listAds({ category: "Outdoor Gear" })).total).toBe(3);

      const nordwind = await prisma.store.findFirst({
        where: { organizationId: organization.id, name: { contains: "Nordwind" } },
      });
      expect((await listAds({ storeId: nordwind!.id })).total).toBe(3);

      const meta = await prisma.advertiser.findFirst({
        where: { organizationId: organization.id, platform: "Meta" },
      });
      const byAdv = await listAds({ advertiserId: meta!.id });
      expect(byAdv.total).toBeGreaterThan(0);
      expect(new Set(byAdv.items.map((a) => a.advertiserId))).toEqual(new Set([meta!.id]));
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("filters by duration and date overlap, sorts deterministically", async () => {
    const { user, organization } = await seededOrg("Ads B");
    try {
      sessionFor(user);

      expect((await listAds({ minDuration: 20 })).total).toBe(3); // 56, 27, 21
      expect((await listAds({ maxDuration: 10 })).total).toBe(3); // 10, 5, 3
      expect((await listAds({ minDuration: 5, maxDuration: 27 })).total).toBe(4); // 27, 21, 10, 5

      const longest = await listAds({ sort: "longest" });
      expect(longest.items[0]?.durationDays).toBe(56);
      const durations = longest.items.map((a) => a.durationDays);
      expect(durations).toEqual([...durations].sort((a, b) => b - a));

      const newest = await listAds({ sort: "newest" });
      const seen = newest.items.map((a) => a.firstSeen.getTime());
      expect(seen).toEqual([...seen].sort((a, b) => b - a));

      // date overlap: a 60-day window ending now catches recent ads only
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      const recent = await listAds({ from, to });
      expect(recent.total).toBeGreaterThan(0);
      expect(recent.total).toBeLessThanOrEqual(6);
      // reversed range is swapped, not emptied
      const swapped = await listAds({ from: to, to: from });
      expect(swapped.total).toBe(recent.total);

      const paged = await listAds({ page: 2, pageSize: 2 });
      expect(paged.items).toHaveLength(2);
      expect(paged.totalPages).toBe(3);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("never leaks another organization's ads", async () => {
    const a = await seededOrg("AdsLeak A");
    const b = await seededOrg("AdsLeak B");
    try {
      sessionFor(a.user);
      const list = await listAds({});
      expect(list.total).toBe(6); // not 12
      const bIds = new Set(
        (
          await prisma.ad.findMany({
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

  it("getAd returns full creative + relations, null when out of scope", async () => {
    const a = await seededOrg("AdDetail A");
    const b = await seededOrg("AdDetail B");
    try {
      sessionFor(a.user);
      const target = await prisma.ad.findFirst({
        where: { organizationId: a.organization.id, title: { contains: "Winter" } },
      });
      const detail = await getAd(target!.id);
      expect(detail?.title).toBe("Winter is coming. Be ready.");
      expect(detail?.advertiser.name).toBe("Nordwind Outdoors");
      expect(detail?.store?.name).toBe("Nordwind Outdoors");
      expect(detail?.durationDays).toBe(21);
      expect(detail?.provenance).toBe("demo");

      expect(await getAd("c".repeat(25))).toBeNull();
      const bAd = await prisma.ad.findFirst({ where: { organizationId: b.organization.id } });
      expect(await getAd(bAd!.id)).toBeNull();
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("advertisers", () => {
  it("lists with stats and resolves profiles with ads", async () => {
    const a = await seededOrg("Adv A");
    const b = await seededOrg("Adv B");
    try {
      sessionFor(a.user);
      const advertisers = await listAdvertisers();
      expect(advertisers).toHaveLength(4);
      expect(new Set(advertisers.map((x) => x.provenance))).toEqual(new Set(["demo"]));
      const meta = advertisers.find((x) => x.platform === "Meta" && x.name.includes("Nordwind"));
      expect(meta?.adCount).toBe(2);
      expect(meta?.store?.name).toBe("Nordwind Outdoors");

      const profile = await getAdvertiser(meta!.id);
      expect(profile?.ads).toHaveLength(2);
      expect(profile?.ads.every((x) => typeof x.durationDays === "number")).toBe(true);

      expect(await getAdvertiser("c".repeat(25))).toBeNull();
      const bAdv = await prisma.advertiser.findFirst({
        where: { organizationId: b.organization.id },
      });
      expect(await getAdvertiser(bAdv!.id)).toBeNull();
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });

  it("exposes filter options", async () => {
    const { user, organization } = await seededOrg("AdvOpts");
    try {
      sessionFor(user);
      const opts = await getAdFilterOptions();
      expect(opts.platforms).toEqual(expect.arrayContaining(["Meta", "TikTok", "Google"]));
      expect(opts.formats).toEqual(expect.arrayContaining(["video", "image", "text"]));
      expect(opts.advertisers.length).toBe(4);
      expect(opts.categories.length).toBeGreaterThan(0);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});
