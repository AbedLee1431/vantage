import { adFilterSchema, parseFilters } from "@/lib/validation";
import { DemoAdvertisingProvider } from "@/server/providers/demo";
import { tenantDb } from "@/server/db/tenant";

/**
 * Ad Intelligence queries (Phase 3). Reads flow through the Demo advertising
 * provider (spec §24); tenant scoping via the underlying client; demo provenance
 * throughout. No performance metrics exist — only observed metadata (FR-AD-05).
 */

function adsProvider(organizationId: string) {
  return new DemoAdvertisingProvider(organizationId);
}

export async function listAds(rawFilters: unknown) {
  const { organizationId } = await tenantDb();
  const filters = parseFilters(adFilterSchema, rawFilters);
  const { items, total, page, pageSize, totalPages } =
    await adsProvider(organizationId).listAds(filters);
  return {
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      platform: a.platform,
      format: a.format,
      status: a.status,
      durationDays: a.durationDays,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      advertiserId: a.advertiserId,
      advertiserName: a.advertiser.name,
      storeId: a.storeId,
      storeName: a.store?.name ?? null,
      provenance: a.provenance,
    })),
    total,
    page,
    pageSize,
    totalPages,
    source: "demo-seed" as const,
  };
}

export async function getAd(id: string) {
  const { organizationId } = await tenantDb();
  const ad = await adsProvider(organizationId).getAd(id);
  if (!ad) return null;
  return {
    id: ad.id,
    title: ad.title,
    primaryText: ad.primaryText,
    headline: ad.headline,
    cta: ad.cta,
    creativeUrl: ad.creativeUrl,
    destinationUrl: ad.destinationUrl,
    platform: ad.platform,
    format: ad.format,
    status: ad.status,
    firstSeen: ad.firstSeen,
    lastSeen: ad.lastSeen,
    durationDays: ad.durationDays,
    provenance: ad.provenance,
    advertiser: {
      id: ad.advertiser.id,
      name: ad.advertiser.name,
      platform: ad.advertiser.platform,
    },
    store: ad.store ? { id: ad.store.id, name: ad.store.name, domain: ad.store.domain } : null,
  };
}

export async function listAdvertisers() {
  const { organizationId } = await tenantDb();
  const advertisers = await adsProvider(organizationId).listAdvertisers();
  return advertisers.map((a) => ({
    id: a.id,
    name: a.name,
    platform: a.platform,
    store: a.store ? { id: a.store.id, name: a.store.name, domain: a.store.domain } : null,
    adCount: a._count.ads,
    provenance: a.provenance,
  }));
}

export async function getAdvertiser(id: string) {
  const { organizationId } = await tenantDb();
  const advertiser = await adsProvider(organizationId).getAdvertiser(id);
  if (!advertiser) return null;
  return {
    id: advertiser.id,
    name: advertiser.name,
    platform: advertiser.platform,
    provenance: advertiser.provenance,
    store: advertiser.store
      ? { id: advertiser.store.id, name: advertiser.store.name, domain: advertiser.store.domain }
      : null,
    adCount: advertiser._count.ads,
    ads: advertiser.ads.map((a) => ({
      id: a.id,
      title: a.title,
      format: a.format,
      status: a.status,
      durationDays: a.durationDays,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      provenance: a.provenance,
    })),
  };
}

export async function getAdFilterOptions() {
  const { organizationId, db } = await tenantDb();
  const provider = adsProvider(organizationId);
  const [platforms, formats, advertisers, categories] = await Promise.all([
    provider.listPlatforms(),
    provider.listFormats(),
    db.advertiser.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, platform: true },
    }),
    db.store.findMany({
      orderBy: { category: "asc" },
      select: { category: true },
      distinct: ["category"],
    }),
  ]);
  return {
    platforms,
    formats,
    advertisers,
    categories: categories.map((c) => c.category),
  };
}
