"use client";

import { useActionState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { renameOrgAction, updateProfileAction, type ActionState } from "@/modules/account/actions";

const initialState: ActionState = { ok: false };

function SavedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="status" className="text-sm font-medium text-accent-700">
      Saved.
    </p>
  );
}

export function ProfileForm({ name, email }: { name: string | null; email: string }) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear in the workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="max-w-md space-y-4">
          {state.error ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
            >
              {state.error}
            </p>
          ) : null}
          <SavedNote show={state.ok} />
          <Field label="Name" htmlFor="profile-name" error={state.fieldErrors?.name?.[0]}>
            <Input
              id="profile-name"
              name="name"
              type="text"
              defaultValue={name ?? ""}
              required
              invalid={!!state.fieldErrors?.name}
            />
          </Field>
          <Field label="Email" htmlFor="profile-email">
            <Input id="profile-email" type="email" value={email} disabled />
          </Field>
          <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function WorkspaceForm({ name }: { name: string }) {
  const [state, formAction] = useActionState(renameOrgAction, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          Your workspace holds all products, stores, ads, and analyses. Plan: Free — billing arrives
          in a later phase.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="max-w-md space-y-4">
          {state.error ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
            >
              {state.error}
            </p>
          ) : null}
          <SavedNote show={state.ok} />
          <Field label="Workspace name" htmlFor="org-name" error={state.fieldErrors?.name?.[0]}>
            <Input
              id="org-name"
              name="name"
              type="text"
              defaultValue={name}
              required
              invalid={!!state.fieldErrors?.name}
            />
          </Field>
          <SubmitButton pendingLabel="Saving…">Save workspace</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
