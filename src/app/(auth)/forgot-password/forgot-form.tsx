"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordResetAction, type ActionState } from "@/modules/auth/actions";

const initialState: ActionState = { ok: false };

export function ForgotForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your account email. In demo mode the reset link is printed to the server console.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.message ? (
            <p
              role="status"
              className="rounded-md bg-accent-100 px-3 py-2 text-sm text-accent-700 ring-1 ring-inset ring-accent-600/20"
            >
              {state.message}
            </p>
          ) : null}
          {state.error ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
            >
              {state.error}
            </p>
          ) : null}
          <Field label="Email" htmlFor="email" error={state.fieldErrors?.email?.[0]}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              invalid={!!state.fieldErrors?.email}
            />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Sending…">
            Send reset link
          </SubmitButton>
          <p className="text-center text-sm">
            <Link href="/login" className="font-medium text-accent-700 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
