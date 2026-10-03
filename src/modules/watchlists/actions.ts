"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/modules/auth/actions";
import {
  createWatchlistSchema,
  removeWatchlistItemSchema,
  toggleSaveSchema,
  toFieldErrors,
  watchlistItemSchema,
} from "@/lib/validation";
import { tenantDb } from "@/server/db/tenant";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/server/errors";
import { SAVED_ITEMS_NAME } from "./queries";

export type { ActionState };

export type ToggleState = ActionState & { saved: boolean };

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

type ItemType = "product" | "store" | "advertiser" | "competitor";

/** Verify a referenced row exists in THIS org (blocks phantom + cross-tenant ids). */
async function targetName(
  db: Awaited<ReturnType<typeof tenantDb>>["db"],
  itemType: ItemType,
  refId: string,
): Promise<string | null> {
  if (itemType === "product") {
    const row = await db.product.findUnique({ where: { id: refId }, select: { name: true } });
    return row?.name ?? null;
  }
  if (itemType === "store") {
    const row = await db.store.findUnique({ where: { id: refId }, select: { name: true } });
    return row?.name ?? null;
  }
  if (itemType === "advertiser") {
    const row = await db.advertiser.findUnique({ where: { id: refId }, select: { name: true } });
    return row?.name ?? null;
  }
  const row = await db.competitor.findUnique({
    where: { id: refId },
    select: { alias: true, store: { select: { name: true } } },
  });
  return row ? (row.alias ?? row.store.name) : null;
}

function canonicalUrl(itemType: ItemType, refId: string): string {
  if (itemType === "product") return `/products/${refId}`;
  if (itemType === "store") return `/stores/${refId}`;
  return "/watchlists";
}

async function savedListId(
  db: Awaited<ReturnType<typeof tenantDb>>["db"],
  organizationId: string,
): Promise<string> {
  const existing = await db.watchlist.findFirst({ where: { name: SAVED_ITEMS_NAME } });
  if (existing) return existing.id;
  const created = await db.watchlist.create({ data: { organizationId, name: SAVED_ITEMS_NAME } });
  return created.id;
}

export async function toggleSaveAction(
  _prev: ToggleState,
  formData: FormData,
): Promise<ToggleState> {
  let db: Awaited<ReturnType<typeof tenantDb>>["db"];
  let organizationId: string;
  try {
    ({ db, organizationId } = await tenantDb());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const parsed = toggleSaveSchema.safeParse({
    itemType: formString(formData, "itemType"),
    refId: formString(formData, "refId"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      saved: false,
      error: "Invalid save request.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { itemType, refId } = parsed.data;

  const name = await targetName(db, itemType, refId);
  if (!name) return { ok: false, saved: false, error: "Item not found." };

  const watchlistId = await savedListId(db, organizationId);
  const existing = await db.watchlistItem.findFirst({ where: { watchlistId, itemType, refId } });
  let saved: boolean;
  if (existing) {
    await db.watchlistItem.delete({ where: { id: existing.id } });
    saved = false;
  } else {
    await db.watchlistItem.create({ data: { watchlistId, organizationId, itemType, refId } });
    saved = true;
  }
  revalidatePath(canonicalUrl(itemType, refId));
  revalidatePath("/watchlists");
  return { ok: true, saved };
}

export async function createWatchlistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let db: Awaited<ReturnType<typeof tenantDb>>["db"];
  let organizationId: string;
  try {
    ({ db, organizationId } = await tenantDb());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const parsed = createWatchlistSchema.safeParse({ name: formString(formData, "name") });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  await db.watchlist.create({ data: { organizationId, name: parsed.data.name } });
  revalidatePath("/watchlists");
  return { ok: true };
}

export async function addWatchlistItemAction(formData: FormData): Promise<void> {
  let db: Awaited<ReturnType<typeof tenantDb>>["db"];
  let organizationId: string;
  try {
    ({ db, organizationId } = await tenantDb());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const parsed = watchlistItemSchema.safeParse({
    watchlistId: formString(formData, "watchlistId"),
    itemType: formString(formData, "itemType"),
    refId: formString(formData, "refId"),
  });
  if (!parsed.success) throw new ValidationError(toFieldErrors(parsed.error));
  const { watchlistId, itemType, refId } = parsed.data;

  // tenantDb scoping makes cross-org watchlist ids resolve to null — fail, don't leak.
  const watchlist = await db.watchlist.findUnique({ where: { id: watchlistId } });
  if (!watchlist) throw new NotFoundError("Watchlist not found.");
  const name = await targetName(db, itemType, refId);
  if (!name) throw new NotFoundError("Item not found.");

  const existing = await db.watchlistItem.findFirst({ where: { watchlistId, itemType, refId } });
  if (!existing) {
    await db.watchlistItem.create({ data: { watchlistId, organizationId, itemType, refId } });
  }
  revalidatePath("/watchlists");
}

export async function removeWatchlistItemAction(formData: FormData): Promise<void> {
  let db: Awaited<ReturnType<typeof tenantDb>>["db"];
  try {
    ({ db } = await tenantDb());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const parsed = removeWatchlistItemSchema.safeParse({ itemId: formString(formData, "itemId") });
  if (!parsed.success) throw new ValidationError(toFieldErrors(parsed.error));
  // WatchlistItem carries organizationId, so this is auto-scoped; null = not ours.
  const item = await db.watchlistItem.findUnique({ where: { id: parsed.data.itemId } });
  if (!item) throw new NotFoundError("Item not found.");
  await db.watchlistItem.delete({ where: { id: item.id } });
  revalidatePath("/watchlists");
}
