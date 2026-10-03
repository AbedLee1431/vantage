import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="space-y-4">
      {params.reset === "1" ? (
        <p
          role="status"
          className="rounded-md bg-accent-100 px-3 py-2 text-sm text-accent-700 ring-1 ring-inset ring-accent-600/20"
        >
          Password updated. Please sign in with your new password.
        </p>
      ) : null}
      <LoginForm redirectTo={typeof params.next === "string" ? params.next : "/dashboard"} />
    </div>
  );
}
