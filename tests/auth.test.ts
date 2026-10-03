import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/server/db/client";
import { verifyCredentials } from "@/server/credentials";
import { signIn } from "@/server/auth";
import {
  registerAction,
  loginAction,
  requestPasswordResetAction,
  confirmPasswordResetAction,
} from "@/modules/auth/actions";
import { createTestOrg, deleteTestOrg } from "./helpers/db";

// Server Actions call Next.js request-scoped APIs; mock the edges, keep all DB logic real.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));

const mockSignIn = vi.mocked(signIn);

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  mockSignIn.mockReset();
});

/** Simulates Auth.js credential rejection (`.name` is what the action matches on). */
function credentialsSigninError(): Error {
  const error = new Error("CredentialsSignin");
  error.name = "CredentialsSignin";
  return error;
}

describe("verifyCredentials (real password check)", () => {
  it("returns the user for valid credentials, null otherwise", async () => {
    const { user, organization } = await createTestOrg();
    try {
      const ok = await verifyCredentials(user.email, "TestPassword123!");
      expect(ok?.id).toBe(user.id);
      expect(await verifyCredentials(user.email, "wrong-password")).toBeNull();
      expect(await verifyCredentials("nobody@example.com", "whatever")).toBeNull();
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});

describe("registerAction", () => {
  it("rejects invalid input without touching the DB", async () => {
    const state = await registerAction(
      { ok: false },
      form({ name: "", email: "bad", password: "short" }),
    );
    expect(state.ok).toBe(false);
    expect(state.fieldErrors).toBeDefined();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rejects duplicate emails", async () => {
    const { user, organization } = await createTestOrg();
    try {
      const state = await registerAction(
        { ok: false },
        form({ name: "Dup", email: user.email, password: "a-very-long-password-123" }),
      );
      expect(state.ok).toBe(false);
      expect(state.error).toMatch(/already exists/);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("provisions user + org + membership + demo data, then signs in", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("REDIRECT:/dashboard"));
    const email = `new-${Date.now()}@example.com`;
    await expect(
      registerAction(
        { ok: false },
        form({ name: "New User", email, password: "a-very-long-password-123" }),
      ),
    ).rejects.toThrow("REDIRECT:/dashboard");

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe("a-very-long-password-123");
    const membership = await prisma.membership.findFirst({
      where: { userId: user!.id },
      include: { organization: true },
    });
    expect(membership?.role).toBe("owner");
    expect(membership?.organization.name).toBe("New's Workspace");
    // demo data provisioned for the fresh org
    expect(
      await prisma.product.count({ where: { organizationId: membership!.organizationId } }),
    ).toBe(7);
    expect(mockSignIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ email }));

    await deleteTestOrg(membership!.organizationId, [user!.id]);
  });
});

describe("loginAction", () => {
  it("rejects invalid input", async () => {
    const state = await loginAction({ ok: false }, form({ email: "bad", password: "" }));
    expect(state.ok).toBe(false);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("maps Auth.js credential failures to an invalid-credentials message", async () => {
    mockSignIn.mockRejectedValueOnce(credentialsSigninError());
    const state = await loginAction(
      { ok: false },
      form({ email: `invalid-${Date.now()}@example.com`, password: "whatever-password" }),
    );
    expect(state).toEqual({ ok: false, error: "Invalid email or password." });
  });

  it("delegates valid input to signIn and follows its redirect", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("REDIRECT:/dashboard"));
    const email = `delegate-${Date.now()}@example.com`;
    await expect(loginAction({ ok: false }, form({ email, password: "x" }))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
    expect(mockSignIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ email }));
  });

  it("enforces the login rate limit after repeated attempts", async () => {
    mockSignIn.mockRejectedValue(new Error("REDIRECT:/dashboard"));
    const fd = form({ email: `spam-${Date.now()}@example.com`, password: "x" });
    for (let i = 0; i < 10; i++) {
      await expect(loginAction({ ok: false }, fd)).rejects.toThrow("REDIRECT:/dashboard");
    }
    const limited = await loginAction({ ok: false }, fd).catch((e) => e);
    expect(String(limited?.message ?? limited)).toMatch(/Too many attempts/i);
    // rate-limit errors carry a reset time (not a redirect, not a credential message)
    expect(limited).toBeInstanceOf(Error);
  });
});

describe("password reset flow", () => {
  it("issues, consumes, and single-uses tokens without revealing existence", async () => {
    const { user, organization } = await createTestOrg();
    try {
      // unknown email still returns ok (no enumeration) — unique per run so the
      // rate-limit key never collides across suite runs
      const unknown = await requestPasswordResetAction(
        { ok: false },
        form({ email: `ghost-${Date.now()}@example.com` }),
      );
      expect(unknown.ok).toBe(true);

      const issued = await requestPasswordResetAction({ ok: false }, form({ email: user.email }));
      expect(issued.ok).toBe(true);
      expect(issued.message).toMatch(/server console/);
      const tokenRow = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
      expect(tokenRow).not.toBeNull();

      // token hash is stored, never the raw token
      expect(tokenRow!.tokenHash).toHaveLength(64);

      // consume with a wrong token fails; we need the RAW token — issue uses a known one
      const { createHash, randomBytes } = await import("node:crypto");
      const raw = randomBytes(32).toString("hex");
      const digest = createHash("sha256").update(raw).digest("hex");
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: digest, expiresAt: new Date(Date.now() + 3_600_000) },
      });
      mockSignIn.mockReset();
      await expect(
        confirmPasswordResetAction(
          { ok: false },
          form({ token: raw, password: "brand-new-password-123" }),
        ),
      ).rejects.toThrow("REDIRECT:/login?reset=1");

      // password actually changed; token marked used
      const ok = await verifyCredentials(user.email, "brand-new-password-123");
      expect(ok?.id).toBe(user.id);
      expect(await verifyCredentials(user.email, "TestPassword123!")).toBeNull();
      const used = await prisma.passwordResetToken.findUnique({ where: { tokenHash: digest } });
      expect(used?.usedAt).not.toBeNull();

      // reuse fails
      const reuse = await confirmPasswordResetAction(
        { ok: false },
        form({ token: raw, password: "another-new-password-1" }),
      );
      expect(reuse.ok).toBe(false);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });

  it("rejects expired tokens", async () => {
    const { user, organization } = await createTestOrg();
    try {
      const { createHash, randomBytes } = await import("node:crypto");
      const raw = randomBytes(32).toString("hex");
      const digest = createHash("sha256").update(raw).digest("hex");
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: digest, expiresAt: new Date(Date.now() - 1000) },
      });
      const state = await confirmPasswordResetAction(
        { ok: false },
        form({ token: raw, password: "brand-new-password-123" }),
      );
      expect(state.ok).toBe(false);
    } finally {
      await deleteTestOrg(organization.id, [user.id]);
    }
  });
});
