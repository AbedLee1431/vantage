"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction, type ActionState } from "@/modules/auth/actions";

const initialState: ActionState = { ok: false };

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          New here?{" "}
          <Link href="/register" className="font-medium text-accent-700 hover:underline">
            Create an account
          </Link>
        </CardDescription>
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
          <Field label="Password" htmlFor="password" error={state.fieldErrors?.password?.[0]}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              invalid={!!state.fieldErrors?.password}
            />
          </Field>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <SubmitButton className="w-full" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="font-medium text-accent-700 hover:underline">
              Forgot your password?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
