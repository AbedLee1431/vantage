"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validation";
import type { FieldErrors } from "@/lib/validation";
import { toFieldErrors } from "@/lib/validation";
import {
  createPasswordResetToken,
  findPasswordResetToken,
  findUserByEmail,
  provisionAccount,
  resetUserPassword,
} from "@/server/db/identity";
import { buildDemoDataset } from "@/server/db/seed-data";
import { signIn, signOut } from "@/server/auth";
import { hashPassword } from "@/server/password";
import { checkRateLimit } from "@/server/db/ratelimit";
import { RateLimitError } from "@/server/errors";

/**
 * Auth Server Actions. Routes (`src/app`) import these; no business logic lives
 * in route files (Architecture.md layering rule).
 */

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: FieldErrors;
};

const fail = (error: string, fieldErrors?: FieldErrors): ActionState => ({
  ok: false,
  error,
  fieldErrors,
});

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Only relative in-app paths (blocks open redirects like `//evil.com`). */
function safeRedirectTo(formData: FormData): string {
  const raw = formString(formData, "redirectTo");
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) {
    return raw;
  }
  return "/dashboard";
}

/**
 * Auth.js raises CredentialsSignin (`.name` set from the constructor) for bad
 * credentials. Matched by name rather than `instanceof CredentialsSignin` because
 * importing next-auth breaks vitest ESM resolution (beta + `next/server`);
 * redirects and unexpected errors are still rethrown, never swallowed.
 */
function isCredentialsSignin(error: unknown): boolean {
  return error instanceof Error && error.name === "CredentialsSignin";
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }
  const { name, email, password } = parsed.data;

  const limit = await checkRateLimit(`register:email:${email}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    throw new RateLimitError(limit.resetAt);
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return fail("An account with this email already exists. Try signing in instead.");
  }

  const passwordHash = await hashPassword(password);
  const firstName = name.split(/\s+/)[0] ?? "My";
  const { organization: org } = await provisionAccount({
    userName: name,
    email,
    passwordHash,
    orgName: `${firstName}'s Workspace`,
  });

  // Fresh org — provision the labeled demo dataset so first-run is useful.
  await buildDemoDataset(org.id);

  try {
    await signIn("credentials", { email, password, redirectTo: safeRedirectTo(formData) });
  } catch (error) {
    if (isCredentialsSignin(error)) {
      return fail("Account created, but automatic sign-in failed. Please sign in.");
    }
    throw error;
  }
  // signIn redirects on success; reaching here means an unexpected non-redirect.
  return fail("Unexpected sign-in state. Please sign in.");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }
  const { email, password } = parsed.data;

  const limit = await checkRateLimit(`login:email:${email}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    throw new RateLimitError(limit.resetAt);
  }

  try {
    await signIn("credentials", { email, password, redirectTo: safeRedirectTo(formData) });
  } catch (error) {
    if (isCredentialsSignin(error)) {
      return fail("Invalid email or password.");
    }
    throw error;
  }
  // signIn redirects on success; reaching here means an unexpected non-redirect.
  return fail("Unexpected sign-in state. Please try again.");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formString(formData, "email") });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }
  const { email } = parsed.data;

  const limit = await checkRateLimit(`reset:email:${email}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    throw new RateLimitError(limit.resetAt);
  }

  // Same response whether or not the account exists (no enumeration).
  const user = await findUserByEmail(email);
  if (user) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await createPasswordResetToken(user.id, tokenHash, new Date(Date.now() + 60 * 60 * 1000));
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    console.log(`[demo] Password reset link for ${email}: ${appUrl}/reset-password/${token}`);
  }
  return {
    ok: true,
    message:
      "If an account exists for this email, a reset link was sent. In demo mode (no email provider configured) the link is printed to the server console.",
  };
}

export async function confirmPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formString(formData, "token"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", toFieldErrors(parsed.error));
  }
  const { token, password } = parsed.data;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await findPasswordResetToken(tokenHash);
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return fail("This reset link is invalid or has expired. Please request a new one.");
  }

  await resetUserPassword(record.id, record.userId, await hashPassword(password));
  redirect("/login?reset=1");
}
