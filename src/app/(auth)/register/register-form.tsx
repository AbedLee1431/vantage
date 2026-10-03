"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { registerAction, type ActionState } from "@/modules/auth/actions";

const initialState: ActionState = { ok: false };

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          A personal workspace with labeled demo data is set up automatically. Already have an
          account?{" "}
          <Link href="/login" className="font-medium text-accent-700 hover:underline">
            Sign in
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
          <Field label="Name" htmlFor="name" error={state.fieldErrors?.name?.[0]}>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              invalid={!!state.fieldErrors?.name}
            />
          </Field>
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
          <Field
            label="Password"
            htmlFor="password"
            hint="At least 12 characters."
            error={state.fieldErrors?.password?.[0]}
          >
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
          <SubmitButton className="w-full" pendingLabel="Creating account…">
            Create account
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
