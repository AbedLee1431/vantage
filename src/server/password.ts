import { hash, verify } from "@node-rs/argon2";
import type { Algorithm } from "@node-rs/argon2";

/** Argon2id password hashing (ADR-004). */

// Argon2id discriminant per the Argon2 spec (d=0, i=1, id=2). Referenced
// numerically because Algorithm is a const enum, which isolatedModules forbids
// as a value. The default is also Argon2id; this makes the choice explicit.
const ARGON2ID = 2 as Algorithm;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { algorithm: ARGON2ID });
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
