"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createWatchlistAction, type ActionState } from "@/modules/watchlists/actions";

const initialState: ActionState = { ok: false };

export function CreateWatchlistForm() {
  const [state, formAction] = useActionState(createWatchlistAction, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>New watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex max-w-md gap-2">
          <Field
            label="Name"
            htmlFor="watchlist-name"
            error={state.fieldErrors?.name?.[0]}
            className="flex-1"
          >
            <Input
              id="watchlist-name"
              name="name"
              type="text"
              placeholder="e.g. Skincare competitors"
              required
              maxLength={100}
              invalid={!!state.fieldErrors?.name}
            />
          </Field>
          <div className="flex items-end">
            <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
          </div>
        </form>
        {state.error && !state.ok ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {state.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
