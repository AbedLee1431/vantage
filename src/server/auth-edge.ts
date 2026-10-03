import NextAuth from "next-auth";

/**
 * Minimal, Edge-safe Auth.js config for the proxy (ADR-004).
 *
 * Verifies the session JWT via AUTH_SECRET only. No providers, no database, no
 * native modules — argon2/pg/node:crypto cannot run on the Edge, so the full
 * config in `./auth` (Credentials provider, custom callbacks) is Node-only.
 * Sign-in always uses the full config; this only *reads* sessions.
 * Logged-in status uses the default `session.user.email` (populated from the
 * JWT user object without any custom callback).
 */
export const { auth } = NextAuth({
  // No sign-in providers here on purpose (see above); session reading only.
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
});
