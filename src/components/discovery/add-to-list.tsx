import { Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { addWatchlistItemAction } from "@/modules/watchlists/actions";
import { listWatchlists } from "@/modules/watchlists/queries";

/**
 * No-JS "add to list" dropdown (native <details> + per-list POST forms).
 * Used on detail pages alongside SaveButton for named lists.
 */
export async function AddToList({
  itemType,
  refId,
}: {
  itemType: "product" | "store" | "advertiser" | "competitor";
  refId: string;
}) {
  const watchlists = await listWatchlists();
  // The default list is covered by SaveButton; offer the rest here.
  const named = watchlists.filter((w) => w.name !== "Saved items");
  if (named.length === 0) return null;

  return (
    <details className="relative inline-block">
      <summary
        className={`${buttonClasses({ variant: "secondary" })} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add to list
      </summary>
      <div className="absolute left-0 z-10 mt-1 w-56 rounded-md bg-white p-1 ring-1 ring-slate-200">
        {named.map((w) => (
          <form key={w.id} action={addWatchlistItemAction}>
            <input type="hidden" name="watchlistId" value={w.id} />
            <input type="hidden" name="itemType" value={itemType} />
            <input type="hidden" name="refId" value={refId} />
            <button
              type="submit"
              className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              {w.name}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
