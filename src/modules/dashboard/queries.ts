import { tenantDb } from "@/server/db/tenant";

/** Dashboard overview (FR-DASH-01). All rows tenant-scoped; all content demo-labeled by callers. */
export async function getDashboardData() {
  const { organization, db } = await tenantDb();

  const [
    storeCount,
    productCount,
    adCount,
    competitorCount,
    recentProducts,
    recentAds,
    recentChanges,
  ] = await Promise.all([
    db.store.count(),
    db.product.count(),
    db.ad.count(),
    db.competitor.count(),
    db.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { store: { select: { name: true } } },
    }),
    db.ad.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        advertiser: { select: { name: true } },
        store: { select: { name: true } },
      },
    }),
    db.changeEvent.findMany({
      orderBy: { detectedAt: "desc" },
      take: 7,
    }),
  ]);

  return {
    organization: { id: organization.id, name: organization.name },
    counts: {
      stores: storeCount,
      products: productCount,
      ads: adCount,
      competitors: competitorCount,
    },
    recentProducts: recentProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      currency: p.currency,
      storeName: p.store.name,
      provenance: p.provenance,
    })),
    recentAds: recentAds.map((a) => ({
      id: a.id,
      title: a.title,
      platform: a.platform,
      format: a.format,
      status: a.status,
      advertiserName: a.advertiser.name,
      storeName: a.store?.name ?? null,
      provenance: a.provenance,
    })),
    recentChanges: recentChanges.map((c) => ({
      id: c.id,
      type: c.type,
      summary: c.summary,
      detectedAt: c.detectedAt,
    })),
  };
}
