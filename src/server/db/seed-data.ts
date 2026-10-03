import type { Prisma } from "@/generated/client";
import { createTenantClient } from "./tenant";

/**
 * Fictional demo dataset (every row `provenance: "demo"`).
 *
 * Used in two places: the `prisma db seed` CLI (demo org) and new-user signup
 * (every org starts populated so the first-run dashboard is useful). Requires an
 * EMPTY organization — it creates rows and relies on per-org unique constraints
 * to fail loudly (never silently duplicate) if called twice.
 *
 * All writes go through the tenant-scoped client with an explicit organizationId
 * (TypeScript enforces it on creates; the extension guarantees it on reads and
 * deletes). No metrics, reviews, or performance claims are real; ad copy
 * deliberately avoids fake social proof.
 */

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function buildDemoDataset(organizationId: string) {
  const db = createTenantClient(organizationId);
  const org = { organizationId };

  const nordwind = await db.store.create({
    data: {
      ...org,
      name: "Nordwind Outdoors",
      domain: "nordwind-outdoors.example",
      category: "Outdoor Gear",
      country: "US",
      platform: "Shopify",
      description: "Direct-to-consumer outdoor apparel and trail gear.",
      provenance: "demo",
    },
  });
  const lumen = await db.store.create({
    data: {
      ...org,
      name: "Lumen Skincare",
      domain: "lumen-skincare.example",
      category: "Beauty & Skincare",
      country: "US",
      platform: "Shopify",
      description: "Fragrance-free skincare for sensitive skin.",
      provenance: "demo",
    },
  });
  const kiln = await db.store.create({
    data: {
      ...org,
      name: "Kiln & Co.",
      domain: "kilnandco.example",
      category: "Home & Living",
      country: "GB",
      platform: "WooCommerce",
      description: "Small-batch stoneware and home goods.",
      provenance: "demo",
    },
  });

  const jacket = await db.product.create({
    data: {
      ...org,
      storeId: nordwind.id,
      name: "Trailhead Insulated Jacket",
      category: "Jackets",
      description: "Recycled-fill insulated jacket with a weatherproof shell.",
      price: 189,
      currency: "USD",
      url: "https://nordwind-outdoors.example/products/trailhead-insulated-jacket",
      tags: ["bestseller", "winter"],
      firstSeen: daysAgo(118),
      lastSeen: daysAgo(0),
      provenance: "demo",
    },
  });
  const pack = await db.product.create({
    data: {
      ...org,
      storeId: nordwind.id,
      name: "Meridian 40L Trail Pack",
      category: "Backpacks",
      description: "40-liter trail pack with ventilated back panel.",
      price: 139,
      currency: "USD",
      url: "https://nordwind-outdoors.example/products/meridian-40l-trail-pack",
      tags: ["new"],
      firstSeen: daysAgo(6),
      lastSeen: daysAgo(0),
      provenance: "demo",
    },
  });
  await db.product.create({
    data: {
      ...org,
      storeId: nordwind.id,
      name: "Basecamp Wool Socks (3-pack)",
      category: "Accessories",
      description: "Merino-blend hiking socks, cushioned sole.",
      price: 34,
      currency: "USD",
      url: "https://nordwind-outdoors.example/products/basecamp-wool-socks",
      tags: ["essentials"],
      firstSeen: daysAgo(95),
      lastSeen: daysAgo(1),
      provenance: "demo",
    },
  });
  const moisturizer = await db.product.create({
    data: {
      ...org,
      storeId: lumen.id,
      name: "Barrier Repair Moisturizer",
      category: "Moisturizers",
      description: "Fragrance-free daily moisturizer with ceramides.",
      price: 42,
      currency: "USD",
      url: "https://lumen-skincare.example/products/barrier-repair-moisturizer",
      tags: ["bestseller", "sensitive-skin"],
      firstSeen: daysAgo(140),
      lastSeen: daysAgo(0),
      provenance: "demo",
    },
  });
  const cleanser = await db.product.create({
    data: {
      ...org,
      storeId: lumen.id,
      name: "Gentle Oat Cleanser",
      category: "Cleansers",
      description: "Low-foam daily cleanser with colloidal oatmeal.",
      price: 24,
      currency: "USD",
      url: "https://lumen-skincare.example/products/gentle-oat-cleanser",
      tags: ["new"],
      firstSeen: daysAgo(1),
      lastSeen: daysAgo(0),
      provenance: "demo",
    },
  });
  const mug = await db.product.create({
    data: {
      ...org,
      storeId: kiln.id,
      name: "Everyday Stoneware Mug, Set of 2",
      category: "Drinkware",
      description: "Hand-finished stoneware mugs, dishwasher safe.",
      price: 48,
      currency: "USD",
      url: "https://kilnandco.example/products/everyday-stoneware-mug-set",
      tags: ["bestseller"],
      firstSeen: daysAgo(200),
      lastSeen: daysAgo(2),
      provenance: "demo",
    },
  });
  await db.product.create({
    data: {
      ...org,
      storeId: kiln.id,
      name: "Serving Bowl, Large",
      category: "Serveware",
      description: "Large serving bowl with reactive glaze.",
      price: 68,
      currency: "USD",
      url: "https://kilnandco.example/products/serving-bowl-large",
      tags: ["low-stock"],
      firstSeen: daysAgo(160),
      lastSeen: daysAgo(3),
      provenance: "demo",
    },
  });

  const nordwindMeta = await db.advertiser.create({
    data: {
      ...org,
      name: "Nordwind Outdoors",
      storeId: nordwind.id,
      platform: "Meta",
      provenance: "demo",
    },
  });
  const nordwindTiktok = await db.advertiser.create({
    data: {
      ...org,
      name: "Nordwind Outdoors",
      storeId: nordwind.id,
      platform: "TikTok",
      provenance: "demo",
    },
  });
  const lumenMeta = await db.advertiser.create({
    data: {
      ...org,
      name: "Lumen Skincare",
      storeId: lumen.id,
      platform: "Meta",
      provenance: "demo",
    },
  });
  const kilnGoogle = await db.advertiser.create({
    data: {
      ...org,
      name: "Kiln & Co.",
      storeId: kiln.id,
      platform: "Google",
      provenance: "demo",
    },
  });

  const ad = async (data: {
    advertiserId: string;
    storeId?: string;
    platform: string;
    title: string;
    primaryText?: string;
    headline?: string;
    cta?: string;
    format: string;
    firstSeen: Date;
    lastSeen: Date;
    status: string;
    destinationUrl?: string;
  }) =>
    db.ad.create({
      data: {
        ...org,
        storeId: data.storeId ?? null,
        destinationUrl: data.destinationUrl ?? null,
        primaryText: data.primaryText ?? null,
        headline: data.headline ?? null,
        cta: data.cta ?? null,
        creativeUrl: null,
        advertiserId: data.advertiserId,
        platform: data.platform,
        title: data.title,
        format: data.format,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen,
        // Derived whole days (see schema comment); recomputed on every rebuild.
        durationDays: Math.max(
          0,
          Math.round((data.lastSeen.getTime() - data.firstSeen.getTime()) / 86_400_000),
        ),
        status: data.status,
        provenance: "demo",
      },
    });

  await ad({
    advertiserId: nordwindMeta.id,
    storeId: nordwind.id,
    platform: "Meta",
    title: "Winter is coming. Be ready.",
    primaryText: "The Trailhead Jacket pairs recycled insulation with a weatherproof shell.",
    headline: "Trailhead Insulated Jacket",
    cta: "Shop Now",
    format: "video",
    firstSeen: daysAgo(21),
    lastSeen: daysAgo(0),
    status: "active",
    destinationUrl: "https://nordwind-outdoors.example/products/trailhead-insulated-jacket",
  });
  await ad({
    advertiserId: nordwindMeta.id,
    storeId: nordwind.id,
    platform: "Meta",
    title: "Pack for the long trail",
    primaryText: "The Meridian 40L carries a weekend of gear with room to spare.",
    cta: "Learn More",
    format: "carousel",
    firstSeen: daysAgo(5),
    lastSeen: daysAgo(0),
    status: "active",
  });
  await ad({
    advertiserId: nordwindTiktok.id,
    storeId: nordwind.id,
    platform: "TikTok",
    title: "3 socks, 0 blisters",
    primaryText: "Basecamp Wool Socks, three pairs to rotate through the week.",
    format: "video",
    firstSeen: daysAgo(34),
    lastSeen: daysAgo(7),
    status: "paused",
  });
  await ad({
    advertiserId: lumenMeta.id,
    storeId: lumen.id,
    platform: "Meta",
    title: "Skincare for sensitive skin",
    primaryText: "Fragrance-free Barrier Repair Moisturizer with ceramides.",
    headline: "Gentle by design",
    cta: "Shop Now",
    format: "image",
    firstSeen: daysAgo(3),
    lastSeen: daysAgo(0),
    status: "active",
  });
  await ad({
    advertiserId: lumenMeta.id,
    storeId: lumen.id,
    platform: "Meta",
    title: "A calmer cleanse",
    primaryText: "Gentle Oat Cleanser, new this week.",
    format: "video",
    firstSeen: daysAgo(12),
    lastSeen: daysAgo(2),
    status: "active",
  });
  await ad({
    advertiserId: kilnGoogle.id,
    storeId: kiln.id,
    platform: "Google",
    title: "Everyday Stoneware Mug Set",
    headline: "Hand-finished, dishwasher safe",
    format: "text",
    firstSeen: daysAgo(60),
    lastSeen: daysAgo(4),
    status: "ended",
  });

  await db.landingPage.create({
    data: {
      ...org,
      storeId: nordwind.id,
      url: "https://nordwind-outdoors.example/pages/winter-lookbook",
      title: "Winter Lookbook",
      firstSeen: daysAgo(40),
      lastSeen: daysAgo(1),
      provenance: "demo",
    },
  });
  await db.landingPage.create({
    data: {
      ...org,
      storeId: lumen.id,
      url: "https://lumen-skincare.example/pages/sensitive-skin-quiz",
      title: "Sensitive Skin Quiz",
      firstSeen: daysAgo(5),
      lastSeen: daysAgo(0),
      provenance: "demo",
    },
  });
  await db.landingPage.create({
    data: {
      ...org,
      storeId: kiln.id,
      url: "https://kilnandco.example/pages/our-process",
      title: "Our Process",
      firstSeen: daysAgo(120),
      lastSeen: daysAgo(10),
      provenance: "demo",
    },
  });

  const review = async (data: {
    productId?: string;
    storeId?: string;
    author?: string;
    rating: number;
    title?: string;
    body: string;
    daysOld: number;
    source?: string;
  }) =>
    db.review.create({
      data: {
        ...org,
        productId: data.productId ?? null,
        storeId: data.storeId ?? null,
        author: data.author ?? null,
        rating: data.rating,
        title: data.title ?? null,
        body: data.body,
        date: daysAgo(data.daysOld),
        source: data.source ?? "demo-import",
        provenance: "demo",
      },
    });

  await review({
    productId: jacket.id,
    author: "Maya R.",
    rating: 5,
    title: "Warm without the bulk",
    body: "Wore it on a windy ridge hike and stayed comfortable. Sleeves run slightly long.",
    daysOld: 12,
  });
  await review({
    productId: jacket.id,
    author: "Tom H.",
    rating: 3,
    title: "Good jacket, slow shipping",
    body: "Jacket itself is great, but delivery took two weeks and tracking never updated.",
    daysOld: 30,
  });
  await review({
    productId: moisturizer.id,
    author: "Priya S.",
    rating: 5,
    title: "Finally, no fragrance",
    body: "My reactive skin tolerates this well. A little goes a long way.",
    daysOld: 8,
  });
  await review({
    productId: moisturizer.id,
    author: "Dana K.",
    rating: 2,
    title: "Pilled under sunscreen",
    body: "Nice texture on its own, but it pilled when I layered sunscreen over it.",
    daysOld: 2,
  });
  await review({
    productId: mug.id,
    author: "Chris P.",
    rating: 5,
    title: "Beautiful glaze",
    body: "Each mug is slightly different, which I love. Arrived well packed.",
    daysOld: 20,
  });
  await review({
    productId: mug.id,
    author: "Alex M.",
    rating: 4,
    title: "Smaller than expected",
    body: "Lovely mugs, just check the dimensions — smaller than a standard diner mug.",
    daysOld: 45,
  });
  await review({
    productId: pack.id,
    author: "Jordan L.",
    rating: 4,
    title: "Comfortable on long days",
    body: "Ventilated back panel works as advertised. Wish it had more hip-belt pockets.",
    daysOld: 4,
  });
  await review({
    storeId: kiln.id,
    author: "Sam W.",
    rating: 5,
    title: "Careful packaging",
    body: "Everything arrived intact. You can tell a small team packs each box.",
    daysOld: 15,
  });

  const lumenCompetitor = await db.competitor.create({
    data: { ...org, storeId: lumen.id, alias: "Lumen (skincare)" },
  });
  await db.competitor.create({
    data: { ...org, storeId: kiln.id, alias: "Kiln & Co. (home)" },
  });

  const watchlist = await db.watchlist.create({
    data: { ...org, name: "Getting started" },
  });
  await db.watchlistItem.create({
    data: { ...org, watchlistId: watchlist.id, itemType: "product", refId: jacket.id },
  });
  await db.watchlistItem.create({
    data: { ...org, watchlistId: watchlist.id, itemType: "store", refId: nordwind.id },
  });
  await db.watchlistItem.create({
    data: { ...org, watchlistId: watchlist.id, itemType: "advertiser", refId: nordwindMeta.id },
  });
  await db.watchlistItem.create({
    data: { ...org, watchlistId: watchlist.id, itemType: "competitor", refId: lumenCompetitor.id },
  });

  const change = async (data: {
    itemType: "product" | "store" | "advertiser" | "competitor";
    refId: string;
    type:
      | "new_product"
      | "removed_product"
      | "new_ad"
      | "ad_activity_change"
      | "price_change"
      | "landing_page_change"
      | "review_change";
    summary: string;
    daysOld: number;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  }) =>
    db.changeEvent.create({
      data: {
        ...org,
        itemType: data.itemType,
        refId: data.refId,
        type: data.type,
        summary: data.summary,
        before: data.before ?? undefined,
        after: data.after ?? undefined,
        detectedAt: daysAgo(data.daysOld),
      },
    });

  await change({
    itemType: "product",
    refId: pack.id,
    type: "new_product",
    summary: "Nordwind Outdoors listed a new product: Meridian 40L Trail Pack.",
    daysOld: 6,
  });
  const cleanserEvent = await change({
    itemType: "product",
    refId: cleanser.id,
    type: "new_product",
    summary: "Lumen Skincare listed a new product: Gentle Oat Cleanser.",
    daysOld: 1,
  });
  const jacketPriceEvent = await change({
    itemType: "product",
    refId: jacket.id,
    type: "price_change",
    summary: "Trailhead Insulated Jacket price changed from $199.00 to $189.00.",
    daysOld: 9,
    before: { price: "199.00", currency: "USD" },
    after: { price: "189.00", currency: "USD" },
  });
  await change({
    itemType: "advertiser",
    refId: lumenMeta.id,
    type: "new_ad",
    summary: "Lumen Skincare started a new Meta ad: Skincare for sensitive skin.",
    daysOld: 3,
  });
  await change({
    itemType: "advertiser",
    refId: nordwindTiktok.id,
    type: "ad_activity_change",
    summary: "Nordwind Outdoors paused TikTok activity (last ad ended 7 days ago).",
    daysOld: 7,
  });
  await change({
    itemType: "store",
    refId: lumen.id,
    type: "landing_page_change",
    summary: "Lumen Skincare published a new landing page: Sensitive Skin Quiz.",
    daysOld: 5,
  });
  const moisturizerReviewEvent = await change({
    itemType: "product",
    refId: moisturizer.id,
    type: "review_change",
    summary: "New 2-star review on Barrier Repair Moisturizer (pilling under sunscreen).",
    daysOld: 2,
  });

  // Example alerts for the most recent events (all demo, unacknowledged).
  // Severity mirrors sync logic: watchlisted refs alert high, others medium.
  // The jacket is on the Getting started list; cleanser and moisturizer are not.
  await db.alert.create({ data: { ...org, changeEventId: cleanserEvent.id, severity: "medium" } });
  await db.alert.create({
    data: { ...org, changeEventId: moisturizerReviewEvent.id, severity: "medium" },
  });
  await db.alert.create({ data: { ...org, changeEventId: jacketPriceEvent.id, severity: "high" } });

  // Detection baseline: everything above predates it, so the first manual sync
  // correctly reports no changes (only genuinely new rows trigger events).
  await db.syncState.create({ data: { organizationId, lastSyncAt: new Date() } });

  return { stores: 3, products: 7, ads: 6, reviews: 8 };
}
