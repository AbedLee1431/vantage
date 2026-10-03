import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/lib/validation";
import { verifyCredentials } from "./credentials";

/**
 * Auth.js v5 (credentials provider, JWT sessions — ADR-004).
 * Identity only; tenant data always goes through `@/server/db/tenant`.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
  interface User {
    id: string;
  }
}

// Note: the JWT `userId` claim is carried via a local cast below, not a
// `declare module "next-auth/jwt"` augmentation — next-auth/jwt re-exports
// @auth/core/jwt, which pnpm does not hoist, so that specifier is unresolvable
// for augmentation. No extra dependency is worth it for a single claim.

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        return verifyCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) {
        (token as Record<string, unknown>).userId = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      const userId = (token as Record<string, unknown>).userId;
      if (typeof userId === "string") {
        session.user.id = userId;
      }
      return session;
    },
  },
});
