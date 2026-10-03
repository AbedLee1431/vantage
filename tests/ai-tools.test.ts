import { describe, it, expect, vi } from "vitest";
import { callTool, toolDefinitions } from "@/server/ai/tools";
import { buildDemoDataset } from "@/server/db/seed-data";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

// Tools take explicit org ids and never call auth() — stub it so the real
// next-auth package is not loaded (vitest ESM friction).
vi.mock("@/server/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

describe("analyst tools (tenant-scoped evidence only)", () => {
  it("exposes a stable, documented tool surface", () => {
    const defs = toolDefinitions();
    expect(defs.map((d) => d.name).sort()).toEqual([
      "getAd",
      "getProduct",
      "getRecentChanges",
      "getReviewInsights",
      "getReviews",
      "getStore",
      "getTrends",
      "listCompetitors",
      "listOpportunities",
      "searchAds",
      "searchProducts",
      "searchStores",
    ]);
    for (const d of defs) {
      expect(d.description.length).toBeGreaterThan(0);
      expect(d.parameters).toBeDefined();
    }
  });

  it("rejects unknown tools; clamps out-of-range args to safe bounds", async () => {
    const { user, organization } = await createTestOrg("Tools A");
    try {
      await expect(callTool(organization.id, "dropTables", {})).rejects.toThrow(/Unknown tool/);
      // Oversized limits clamp instead of throwing (bounded, safe defaults).
      const clamped = (await callTool(organization.id, "searchProducts", { limit: 9999 })) as {
        total: number;
        items: unknown[];
      };
      expect(clamped.items.length).toBeLessThanOrEqual(20);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("scopes every tool to the caller's org", async () => {
    const a = await createTestOrg("ToolsLeak A");
    const b = await createTestOrg("ToolsLeak B");
    await buildDemoDataset(a.organization.id);
    await buildDemoDataset(b.organization.id);
    try {
      const products = (await callTool(a.organization.id, "searchProducts", { q: "" })) as {
        total: number;
        items: { id: string }[];
      };
      expect(products.total).toBe(7);
      // cross-org id lookups resolve to not-found, never to B's rows
      const bProduct = await callTool(b.organization.id, "searchProducts", { q: "Jacket" });
      const bId = (bProduct as { items: { id: string }[] }).items[0]?.id as string;
      const viaA = (await callTool(a.organization.id, "getProduct", { id: bId })) as {
        found: boolean;
      };
      expect(viaA.found).toBe(false);

      const trends = (await callTool(a.organization.id, "getTrends", {})) as {
        summary: string[];
      };
      expect(trends.summary.length).toBeGreaterThan(0);
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});
