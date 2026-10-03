import { tenantDb } from "@/server/db/tenant";

export const SAVED_ITEMS_NAME = "Saved items";

export type WatchlistDisplayItem = {
  itemId: string;
  itemType: "product" | "store" | "advertiser" | "competitor";
  refId: string;
  name: string;
  subtitle: string;
  url: string | null;
  addedAt: Date;
};

export type WatchlistDisplay = {
  id: string;
  name: string;
  itemCount: number;
  items: WatchlistDisplayItem[];
};

/** All watchlists with items resolved to display rows (names + links). */
export async function listWatchlists(): Promise<WatchlistDisplay[]> {
  const { db } = await tenantDb();
  const watchlists = await db.watchlist.findMany({
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });
  if (watchlists.length === 0) return [];

  // Batch-resolve polymorphic refs per type (no N+1).
  const byType = new Map<string, Set<string>>();
  for (const w of watchlists) {
    for (const item of w.items) {
      if (!byType.has(item.itemType)) byType.set(item.itemType, new Set());
      byType.get(item.itemType)!.add(item.refId);
    }
  }
  const [products, stores, advertisers, competitors] = await Promise.all([
    byType.has("product")
      ? db.product.findMany({
          where: { id: { in: [...byType.get("product")!] } },
          select: { id: true, name: true, category: true, store: { select: { name: true } } },
        })
      : [],
    byType.has("store")
      ? db.store.findMany({
          where: { id: { in: [...byType.get("store")!] } },
          select: { id: true, name: true, domain: true },
        })
      : [],
    byType.has("advertiser")
      ? db.advertiser.findMany({
          where: { id: { in: [...byType.get("advertiser")!] } },
          select: { id: true, name: true, platform: true, storeId: true },
        })
      : [],
    byType.has("competitor")
      ? db.competitor.findMany({
          where: { id: { in: [...byType.get("competitor")!] } },
          select: { id: true, alias: true, store: { select: { id: true, name: true } } },
        })
      : [],
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const advertiserById = new Map(advertisers.map((a) => [a.id, a]));
  const competitorById = new Map(competitors.map((c) => [c.id, c]));

  return watchlists.map((w) => ({
    id: w.id,
    name: w.name,
    itemCount: w.items.length,
    items: w.items.flatMap((item): WatchlistDisplayItem[] => {
      const base = {
        itemId: item.id,
        itemType: item.itemType as WatchlistDisplayItem["itemType"],
        refId: item.refId,
        addedAt: item.addedAt,
      };
      if (item.itemType === "product") {
        const p = productById.get(item.refId);
        if (!p) return [];
        return [
          {
            ...base,
            name: p.name,
            subtitle: `${p.store.name} · ${p.category}`,
            url: `/products/${p.id}`,
          },
        ];
      }
      if (item.itemType === "store") {
        const s = storeById.get(item.refId);
        if (!s) return [];
        return [{ ...base, name: s.name, subtitle: s.domain, url: `/stores/${s.id}` }];
      }
      if (item.itemType === "advertiser") {
        const a = advertiserById.get(item.refId);
        if (!a) return [];
        return [
          {
            ...base,
            name: a.name,
            subtitle: a.platform,
            url: a.storeId ? `/stores/${a.storeId}` : null,
          },
        ];
      }
      const c = competitorById.get(item.refId);
      if (!c) return [];
      return [
        {
          ...base,
          name: c.alias ?? c.store.name,
          subtitle: `Tracked competitor · ${c.store.name}`,
          url: `/stores/${c.store.id}`,
        },
      ];
    }),
  }));
}

/** Whether an entity is in the org's default "Saved items" list (for Save buttons). */
export async function getSaveState(
  itemType: WatchlistDisplayItem["itemType"],
  refId: string,
): Promise<{ saved: boolean }> {
  const { db } = await tenantDb();
  const savedList = await db.watchlist.findFirst({ where: { name: SAVED_ITEMS_NAME } });
  if (!savedList) return { saved: false };
  const existing = await db.watchlistItem.findFirst({
    where: { watchlistId: savedList.id, itemType, refId },
  });
  return { saved: existing !== null };
}
