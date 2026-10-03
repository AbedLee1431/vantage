import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { buildDemoDataset } from "@/server/db/seed-data";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

// buildDemoDataset transitively imports @/server/auth (unused here) — stub it so the
// real next-auth package is not loaded (vitest ESM friction).
vi.mock("@/server/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

describe("demo seed dataset", () => {
  it("builds a coherent, fully demo-labeled dataset with working relationships", async () => {
    const { user, organization } = await createTestOrg();
    try {
      const counts = await buildDemoDataset(organization.id);
      expect(counts).toEqual({ stores: 3, products: 7, ads: 6, reviews: 8 });

      // Monitoring baseline: 3 example alerts (1 high for the watchlisted jacket)
      // and a sync-state row covering all seed rows.
      expect(await prisma.alert.count({ where: { organizationId: organization.id } })).toBe(3);
      expect(
        await prisma.alert.count({
          where: { organizationId: organization.id, severity: "high" },
        }),
      ).toBe(1);
      const syncState = await prisma.syncState.findUnique({
        where: { organizationId: organization.id },
      });
      expect(syncState?.lastSyncAt).toBeInstanceOf(Date);

      // every sourced row is labeled demo
      for (const model of [
        "store",
        "product",
        "advertiser",
        "ad",
        "landingPage",
        "review",
      ] as const) {
        const rows = await (
          prisma[model] as { findMany: (a: unknown) => Promise<{ provenance: string }[]> }
        ).findMany({
          where: { organizationId: organization.id },
        });
        expect(rows.length).toBeGreaterThan(0);
        expect(new Set(rows.map((r) => r.provenance))).toEqual(new Set(["demo"]));
      }

      // relationships resolve: products → store, ads → advertiser + store
      const product = await prisma.product.findFirst({
        where: { organizationId: organization.id },
        include: { store: true },
      });
      expect(product?.store.name).toBeTruthy();
      const ad = await prisma.ad.findFirst({
        where: { organizationId: organization.id },
        include: { advertiser: true },
      });
      expect(ad?.advertiser.name).toBeTruthy();

      // competitors, watchlist, and change events exist
      expect(await prisma.competitor.count({ where: { organizationId: organization.id } })).toBe(2);
      expect(await prisma.watchlist.count({ where: { organizationId: organization.id } })).toBe(1);
      expect(await prisma.changeEvent.count({ where: { organizationId: organization.id } })).toBe(
        7,
      );
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("fails loudly (never silently duplicates) if run twice on the same org", async () => {
    const { user, organization } = await createTestOrg();
    try {
      await buildDemoDataset(organization.id);
      await expect(buildDemoDataset(organization.id)).rejects.toThrow();
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});
