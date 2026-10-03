import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import { getAccount } from "@/modules/account/queries";
import { updateProfileAction, renameOrgAction } from "@/modules/account/actions";
import { getDashboardData } from "@/modules/dashboard/queries";
import { buildDemoDataset } from "@/server/db/seed-data";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

const mockAuth = auth as unknown as {
  mockResolvedValue: (
    session: { user: { id: string; email: string; name: string | null }; expires: string } | null,
  ) => void;
};

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

function sessionFor(user: { id: string; email: string; name: string | null }) {
  mockAuth.mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

describe("account module (session-derived authorization)", () => {
  it("updates the signed-in user's profile and revalidates", async () => {
    const { user, organization } = await createTestOrg();
    try {
      sessionFor(user);
      const state = await updateProfileAction({ ok: false }, form({ name: "Renamed User" }));
      expect(state.ok).toBe(true);
      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.name).toBe("Renamed User");
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("renames only the session organization — cross-org rename is structurally impossible", async () => {
    const a = await createTestOrg("Org A");
    const b = await createTestOrg("Org B");
    try {
      sessionFor(a.user);
      // the action takes no org identifier; it can only ever rename A's org
      const state = await renameOrgAction({ ok: false }, form({ name: "Org A Renamed" }));
      expect(state.ok).toBe(true);
      expect(
        (await prisma.organization.findUnique({ where: { id: a.organization.id } }))?.name,
      ).toBe("Org A Renamed");
      expect(
        (await prisma.organization.findUnique({ where: { id: b.organization.id } }))?.name,
      ).toBe("Org B");
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });

  it("rejects unauthenticated callers with a login redirect", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(updateProfileAction({ ok: false }, form({ name: "X" }))).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("getAccount returns the session user and org", async () => {
    const { user, organization } = await createTestOrg();
    try {
      sessionFor(user);
      const account = await getAccount();
      expect(account.user.id).toBe(user.id);
      expect(account.organization.id).toBe(organization.id);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("dashboard queries (tenant-scoped reads)", () => {
  it("returns only the session organization's data", async () => {
    const a = await createTestOrg("Dash A");
    const b = await createTestOrg("Dash B");
    try {
      await buildDemoDataset(a.organization.id);
      await buildDemoDataset(b.organization.id);

      sessionFor(a.user);
      const data = await getDashboardData();
      expect(data.organization.id).toBe(a.organization.id);
      expect(data.counts).toEqual({ stores: 3, products: 7, ads: 6, competitors: 2 });
      expect(data.recentProducts).toHaveLength(5);
      expect(data.recentAds).toHaveLength(5);
      expect(data.recentChanges).toHaveLength(7);
      // prices are plain numbers (serializable), provenance is labeled
      expect(typeof data.recentProducts[0]?.price).toBe("number");
      expect(new Set(data.recentProducts.map((p) => p.provenance))).toEqual(new Set(["demo"]));
      // B's ROWS never appear (compare ids — demo store names are identical by design)
      const bProductIds = new Set(
        (
          await prisma.product.findMany({
            where: { organizationId: b.organization.id },
            select: { id: true },
          })
        ).map((p) => p.id),
      );
      for (const p of data.recentProducts) {
        expect(bProductIds.has(p.id)).toBe(false);
      }
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});
