import type { Ad, Advertiser, Product, Review, Store } from "@/generated/client";
import type { AdFilters, ProductFilters, ReviewFilters, StoreFilters } from "./validation";

/**
 * Data-provider interfaces (spec §24). The seam future live providers implement.
 * Phase 2 covers products + stores; advertising/review providers arrive with
 * their phases (Ph3/Ph5) behind the same pattern.
 *
 * Providers NEVER talk to external services in the MVP — Demo implementations
 * read the tenant-scoped database (seeded, labeled demo) and say so via `source`.
 * A provider is "live" only when it actually calls the external service (§25).
 */

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type StoreWithCounts = Store & {
  _count: { products: number };
};

export type ProductWithStore = Product & {
  store: Pick<Store, "id" | "name" | "domain">;
};

export type StoreWithProducts = Store & {
  products: Product[];
  _count: { products: number };
};

export interface ProductDataProvider {
  /** Stable source id for provenance display (Demo: "demo-seed"). */
  readonly source: string;
  list(filters: ProductFilters): Promise<Paged<ProductWithStore>>;
  getById(id: string): Promise<ProductWithStore | null>;
  listCategories(): Promise<string[]>;
}

export interface StoreDataProvider {
  readonly source: string;
  list(filters: StoreFilters): Promise<Paged<StoreWithCounts>>;
  getById(id: string): Promise<StoreWithProducts | null>;
  listCategories(): Promise<string[]>;
  listCountries(): Promise<string[]>;
  listPlatforms(): Promise<string[]>;
}

// Phase 3: advertising provider (reviews arrive in Phase 5 behind the same pattern).
export type AdWithRelations = Ad & {
  advertiser: Pick<Advertiser, "id" | "name" | "platform">;
  store: Pick<Store, "id" | "name" | "domain"> | null;
};

export type AdvertiserWithStats = Advertiser & {
  store: Pick<Store, "id" | "name" | "domain"> | null;
  _count: { ads: number };
};

export type AdvertiserDetail = AdvertiserWithStats & {
  ads: Ad[];
};

export interface AdvertisingDataProvider {
  readonly source: string;
  listAds(filters: AdFilters): Promise<Paged<AdWithRelations>>;
  getAd(id: string): Promise<AdWithRelations | null>;
  listAdvertisers(): Promise<AdvertiserWithStats[]>;
  getAdvertiser(id: string): Promise<AdvertiserDetail | null>;
  listPlatforms(): Promise<string[]>;
  listFormats(): Promise<string[]>;
}

// Phase 5: review provider (live review sources arrive behind this seam).
export type ReviewWithRefs = Review & {
  product: Pick<Product, "id" | "name"> | null;
  store: Pick<Store, "id" | "name"> | null;
};

export interface ReviewDataProvider {
  readonly source: string;
  list(filters: ReviewFilters): Promise<Paged<ReviewWithRefs>>;
  getById(id: string): Promise<ReviewWithRefs | null>;
}
