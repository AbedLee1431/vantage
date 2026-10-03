import { findUserByEmail } from "./db/identity";
import { verifyPassword } from "./password";

/**
 * Shared credential check. Used by the Auth.js credentials provider AND by
 * integration tests (which cannot run Auth.js `signIn` outside a request scope).
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string; name: string | null } | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name };
}
