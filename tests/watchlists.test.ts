import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import {
  addWatchlistItemAction,
  createWatchlistAction,
  removeWatchlistItemAction,
  toggleSaveAction,
} from "@/modules/watchlists/actions";
import { getSaveState, listWatchlists } from "@/modules/watchlists/queries";
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

describe("watchlist save toggle", () => {
  it("saves and unsaves, rejects phantom and cross-org ids", async () => {
    const a = await createTestOrg("Save A");
    const b = await createTestOrg("Save B");
    await buildDemoDataset(a.organization.id);
    await buildDemoDataset(b.organization.id);
    try {
      sessionFor(a.user);
      const jacket = await prisma.product.findFirst({
        where: { organizationId: a.organization.id, name: { contains: "Jacket" } },
      });

      expect(await getSaveState("product", jacket!.id)).toEqual({ saved: false });
      const saved = await toggleSaveAction(
        { ok: true, saved: false },
        form({ itemType: "product", refId: jacket!.id }),
      );
      expect(saved).toEqual({ ok: true, saved: true });
      expect(await getSaveState("product", jacket!.id)).toEqual({ saved: true });

      const unsaved = await toggleSaveAction(
        { ok: true, saved: true },
        form({ itemType: "product", refId: jacket!.id }),
      );
      expect(unsaved).toEqual({ ok: true, saved: false });

      // phantom id fails
      const phantom = await toggleSaveAction(
        { ok: true, saved: false },
        form({ itemType: "product", refId: "c".repeat(25) }),
      );
      expect(phantom.ok).toBe(false);

      // cross-org id fails (B's product is invisible to A's session)
      const bProduct = await prisma.product.findFirst({
        where: { organizationId: b.organization.id },
      });
      const cross = await toggleSaveAction(
        { ok: true, saved: false },
        form({ itemType: "product", refId: bProduct!.id }),
      );
      expect(cross.ok).toBe(false);
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });

  it("rejects invalid toggle input", async () => {
    const { user, organization } = await createTestOrg("SaveInvalid");
    try {
      sessionFor(user);
      const state = await toggleSaveAction(
        { ok: true, saved: false },
        form({ itemType: "spaceship", refId: "" }),
      );
      expect(state.ok).toBe(false);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("watchlist create/add/remove", () => {
  it("creates lists and adds/removes items with tenant checks", async () => {
    const a = await createTestOrg("Lists A");
    const b = await createTestOrg("Lists B");
    await buildDemoDataset(a.organization.id);
    try {
      sessionFor(a.user);

      const created = await createWatchlistAction({ ok: false }, form({ name: "Skincare watch" }));
      expect(created.ok).toBe(true);
      const bad = await createWatchlistAction({ ok: false }, form({ name: "" }));
      expect(bad.ok).toBe(false);

      const list = await prisma.watchlist.findFirst({
        where: { organizationId: a.organization.id, name: "Skincare watch" },
      });
      const moisturizer = await prisma.product.findFirst({
        where: { organizationId: a.organization.id, name: { contains: "Moisturizer" } },
      });

      await addWatchlistItemAction(
        form({ watchlistId: list!.id, itemType: "product", refId: moisturizer!.id }),
      );
      // idempotent re-add resolves without duplicating
      await addWatchlistItemAction(
        form({ watchlistId: list!.id, itemType: "product", refId: moisturizer!.id }),
      );
      expect(
        await prisma.watchlistItem.count({
          where: { watchlistId: list!.id, refId: moisturizer!.id },
        }),
      ).toBe(1);

      // cross-org watchlist id is rejected (resolves to null under A's scope).
      // B was never seeded, so create one of its lists directly to prove the block.
      const bDirect = await prisma.watchlist.create({
        data: { organizationId: b.organization.id, name: "B list" },
      });
      await expect(
        addWatchlistItemAction(
          form({ watchlistId: bDirect.id, itemType: "product", refId: moisturizer!.id }),
        ),
      ).rejects.toThrow(/not found/i);

      // remove works; cross-org item removal is rejected
      const item = await prisma.watchlistItem.findFirst({ where: { watchlistId: list!.id } });
      await removeWatchlistItemAction(form({ itemId: item!.id }));
      expect(await prisma.watchlistItem.findUnique({ where: { id: item!.id } })).toBeNull();

      const bItem = await prisma.watchlistItem.create({
        data: {
          organizationId: b.organization.id,
          watchlistId: bDirect.id,
          itemType: "product",
          refId: moisturizer!.id,
        },
      });
      await expect(removeWatchlistItemAction(form({ itemId: bItem.id }))).rejects.toThrow(
        /not found/i,
      );
    } finally {
      await deleteTestOrg(a.organization.id, [a.user.id]);
      await deleteTestOrg(b.organization.id, [b.user.id]);
    }
  });
});

describe("watchlist listing", () => {
  it("resolves items to display rows within the org", async () => {
    const { user, organization } = await createTestOrg("ListView");
    await buildDemoDataset(organization.id);
    try {
      sessionFor(user);
      const lists = await listWatchlists();
      expect(lists).toHaveLength(1);
      expect(lists[0]?.name).toBe("Getting started");
      expect(lists[0]?.itemCount).toBe(4);
      for (const item of lists[0]?.items ?? []) {
        expect(item.name).toBeTruthy();
        expect(item.subtitle).toBeTruthy();
      }
      // every item links to a real route (or null only for unlinked advertisers)
      const urls = (lists[0]?.items ?? []).map((i) => i.url);
      expect(urls.filter(Boolean).length).toBeGreaterThan(0);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});
