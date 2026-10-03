"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { toggleSaveAction, type ToggleState } from "@/modules/watchlists/actions";

const initialState: ToggleState = { ok: true, saved: false };

/** Save/Unsave toggle (posts to the default "Saved items" list). */
export function SaveButton({
  itemType,
  refId,
  initialSaved,
}: {
  itemType: "product" | "store" | "advertiser" | "competitor";
  refId: string;
  initialSaved: boolean;
}) {
  const [state, formAction] = useActionState(toggleSaveAction, {
    ...initialState,
    saved: initialSaved,
  });
  const saved = state.saved;
  return (
    <form action={formAction}>
      {state.error ? (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="itemType" value={itemType} />
      <input type="hidden" name="refId" value={refId} />
      <SubmitButton
        variant={saved ? "secondary" : "primary"}
        pendingLabel={saved ? "Removing…" : "Saving…"}
      >
        {saved ? (
          <>
            <BookmarkCheck className="h-4 w-4" aria-hidden /> Saved
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" aria-hidden /> Save
          </>
        )}
      </SubmitButton>
    </form>
  );
}
