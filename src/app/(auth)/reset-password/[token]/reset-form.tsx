"use client";

import { useActionState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { confirmPasswordResetAction, type ActionState } from "@/modules/auth/actions";

const initialState: ActionState = { ok: false };

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(confirmPasswordResetAction, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>At least 12 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
            >
              {state.error}
            </p>
          ) : null}
          <Field label="New password" htmlFor="password" error={state.fieldErrors?.password?.[0]}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              invalid={!!state.fieldErrors?.password}
            />
          </Field>
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="w-full" pendingLabel="Updating…">
            Update password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
