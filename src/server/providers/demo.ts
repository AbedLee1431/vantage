import type {
  AdvertiserDetail,
  AdvertiserWithStats,
  AdWithRelations,
  AdvertisingDataProvider,
  Paged,
  ProductDataProvider,
  ProductWithStore,
  ReviewDataProvider,
  ReviewWithRefs,
  StoreDataProvider,
  StoreWithCounts,
  StoreWithProducts,
} from "@/lib/providers";
import type { AdFilters, ProductFilters, ReviewFilters, StoreFilters } from "@/lib/validation";
import { createTenantClient } from "@/server/db/tenant";

/**
 * Demo data providers (spec §24/§25). They read ONLY the tenant-scoped database
 * (seeded fictional rows, always `provenance: "demo"`) and identify as
 * `demo-seed`. They never call, imitate, or imply an external service.
 * Future live providers implement the same interfaces in `src/server/providers/`.
 */

function paged<T>(items: T[], total: number, page: number, pageSize: number): Paged<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export class DemoProductProvider implements ProductDataProvider {
  readonly source = "demo-seed";
  private db: ReturnType<typeof createTenantClient>;

  constructor(organizationId: string) {
    this.db = createTenantClient(organizationId);
  }

  async list(filters: ProductFilters): Promise<Paged<ProductWithStore>> {
    const { q, category, storeId, minPrice, maxPrice, sort, page, pageSize } = filters;
    const where = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
              { tags: { has: q } },
            ],
          }
        : {}),
      ...(category ? { category } : {}),
      ...(storeId ? { storeId } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          }
        : {}),
    };
    const orderBy =
      sort === "price-asc"
        ? { price: "asc" as const }
        : sort === "price-desc"
          ? { price: "desc" as const }
          : sort === "name"
            ? { name: "asc" as const }
            : { firstSeen: "desc" as const };
    const [total, items] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { store: { select: { id: true, name: true, domain: true } } },
      }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async getById(id: string): Promise<ProductWithStore | null> {
    return this.db.product.findUnique({
      where: { id },
      include: { store: { select: { id: true, name: true, domain: true } } },
    });
  }

  async listCategories(): Promise<string[]> {
    const rows = await this.db.product.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category);
  }
}

export class DemoStoreProvider implements StoreDataProvider {
  readonly source = "demo-seed";
  private db: ReturnType<typeof createTenantClient>;

  constructor(organizationId: string) {
    this.db = createTenantClient(organizationId);
  }

  async list(filters: StoreFilters): Promise<Paged<StoreWithCounts>> {
    const { q, category, country, platform, sort, page, pageSize } = filters;
    const where = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { domain: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(category ? { category } : {}),
      ...(country ? { country } : {}),
      ...(platform ? { platform } : {}),
    };
    const orderBy =
      sort === "newest"
        ? { createdAt: "desc" as const }
        : sort === "products"
          ? { products: { _count: "desc" as const } }
          : { name: "asc" as const };
    const [total, items] = await Promise.all([
      this.db.store.count({ where }),
      this.db.store.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { products: true } } },
      }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async getById(id: string): Promise<StoreWithProducts | null> {
    return this.db.store.findUnique({
      where: { id },
      include: {
        products: { orderBy: { firstSeen: "desc" } },
        _count: { select: { products: true } },
      },
    });
  }

  async listCategories(): Promise<string[]> {
    const rows = await this.db.store.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category);
  }

  async listCountries(): Promise<string[]> {
    const rows = await this.db.store.findMany({
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    });
    return rows.map((r) => r.country);
  }

  async listPlatforms(): Promise<string[]> {
    const rows = await this.db.store.findMany({
      select: { platform: true },
      distinct: ["platform"],
      orderBy: { platform: "asc" },
    });
    return rows.map((r) => r.platform);
  }
}

export class DemoAdvertisingProvider implements AdvertisingDataProvider {
  readonly source = "demo-seed";
  private db: ReturnType<typeof createTenantClient>;

  constructor(organizationId: string) {
    this.db = createTenantClient(organizationId);
  }

  async listAds(filters: AdFilters): Promise<Paged<AdWithRelations>> {
    const { q, platform, advertiserId, storeId, category, format } = filters;
    const { minDuration, maxDuration, from, to, sort, page, pageSize } = filters;

    // Date bounds filter by overlap (ads running at any point in [from, to]).
    // Invalid strings are ignored; a reversed range is swapped (lenient reads).
    const parseDate = (s: string | undefined): Date | undefined => {
      if (!s) return undefined;
      const d = new Date(`${s}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    let fromDate = parseDate(from);
    let toDate = parseDate(to);
    if (fromDate && toDate && fromDate > toDate) {
      [fromDate, toDate] = [toDate, fromDate];
    }

    const where = {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { primaryText: { contains: q, mode: "insensitive" as const } },
              { headline: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(platform ? { platform } : {}),
      ...(advertiserId ? { advertiserId } : {}),
      ...(storeId ? { storeId } : {}),
      ...(category ? { store: { category } } : {}),
      ...(format ? { format } : {}),
      ...(minDuration !== undefined || maxDuration !== undefined
        ? {
            durationDays: {
              ...(minDuration !== undefined ? { gte: minDuration } : {}),
              ...(maxDuration !== undefined ? { lte: maxDuration } : {}),
            },
          }
        : {}),
      ...(fromDate || toDate
        ? {
            ...(toDate ? { firstSeen: { lte: toDate } } : {}),
            ...(fromDate ? { lastSeen: { gte: fromDate } } : {}),
          }
        : {}),
    };
    const orderBy =
      sort === "oldest"
        ? { firstSeen: "asc" as const }
        : sort === "longest"
          ? { durationDays: "desc" as const }
          : { firstSeen: "desc" as const };
    const include = {
      advertiser: { select: { id: true, name: true, platform: true } },
      store: { select: { id: true, name: true, domain: true } },
    } as const;
    const [total, items] = await Promise.all([
      this.db.ad.count({ where }),
      this.db.ad.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async getAd(id: string): Promise<AdWithRelations | null> {
    return this.db.ad.findUnique({
      where: { id },
      include: {
        advertiser: { select: { id: true, name: true, platform: true } },
        store: { select: { id: true, name: true, domain: true } },
      },
    });
  }

  async listAdvertisers(): Promise<AdvertiserWithStats[]> {
    return this.db.advertiser.findMany({
      orderBy: { name: "asc" },
      include: {
        store: { select: { id: true, name: true, domain: true } },
        _count: { select: { ads: true } },
      },
    });
  }

  async getAdvertiser(id: string): Promise<AdvertiserDetail | null> {
    return this.db.advertiser.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, domain: true } },
        _count: { select: { ads: true } },
        ads: { orderBy: { firstSeen: "desc" } },
      },
    });
  }

  async listPlatforms(): Promise<string[]> {
    const rows = await this.db.ad.findMany({
      select: { platform: true },
      distinct: ["platform"],
      orderBy: { platform: "asc" },
    });
    return rows.map((r) => r.platform);
  }

  async listFormats(): Promise<string[]> {
    const rows = await this.db.ad.findMany({
      select: { format: true },
      distinct: ["format"],
      orderBy: { format: "asc" },
    });
    return rows.map((r) => r.format);
  }
}

export class DemoReviewProvider implements ReviewDataProvider {
  readonly source = "demo-seed";
  private db: ReturnType<typeof createTenantClient>;

  constructor(organizationId: string) {
    this.db = createTenantClient(organizationId);
  }

  async list(filters: ReviewFilters): Promise<Paged<ReviewWithRefs>> {
    const { q, productId, storeId, rating, from, to, sort, page, pageSize } = filters;

    const parseDate = (s: string | undefined): Date | undefined => {
      if (!s) return undefined;
      const d = new Date(`${s}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    let fromDate = parseDate(from);
    let toDate = parseDate(to);
    if (fromDate && toDate && fromDate > toDate) {
      [fromDate, toDate] = [toDate, fromDate];
    }

    const where = {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { body: { contains: q, mode: "insensitive" as const } },
              { author: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(productId ? { productId } : {}),
      ...(storeId ? { storeId } : {}),
      ...(rating !== undefined ? { rating } : {}),
      ...(fromDate || toDate
        ? {
            date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };
    const orderBy =
      sort === "oldest"
        ? { date: "asc" as const }
        : sort === "highest"
          ? { rating: "desc" as const }
          : sort === "lowest"
            ? { rating: "asc" as const }
            : { date: "desc" as const };
    const include = {
      product: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
    } as const;
    const [total, items] = await Promise.all([
      this.db.review.count({ where }),
      this.db.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async getById(id: string): Promise<ReviewWithRefs | null> {
    return this.db.review.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
      },
    });
  }
}
