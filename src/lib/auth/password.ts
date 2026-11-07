/**
 * Midman.bd — Password hashing.
 *
 * bcrypt with a per-password random salt (embedded in the hash), cost
 * factor 12. The plaintext password is NEVER stored, logged, or echoed.
 *
 * Kept as an isolated module so the hash algorithm can be swapped
 * (e.g. argon2id) later without touching session or route code.
 */

import "server-only";

import bcrypt from "bcryptjs";

/** Work factor — 12 is the current mainstream security/perf balance. */
const BCRYPT_COST = 12;

/** Minimum/maximum accepted plaintext length (bcrypt input cap is 72 bytes). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Pre-computed bcrypt hash of a random throwaway string. Used ONLY to
 * keep "unknown email" and "wrong password" responses timing-equivalent
 * (both run one real bcrypt comparison), so response time cannot be
 * used to enumerate registered accounts.
 */
const DUMMY_HASH = bcrypt.hashSync(
  crypto.randomUUID() + crypto.randomUUID(),
  BCRYPT_COST
);

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

/** Constant-work password check — safe against missing users (dummy hash). */
export function verifyPassword(plain: string, hash: string | null): boolean {
  return bcrypt.compareSync(plain, hash ?? DUMMY_HASH);
}
