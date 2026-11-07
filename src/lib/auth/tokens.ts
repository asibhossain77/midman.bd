/**
 * Midman.bd — One-time email tokens (verification + password reset).
 *
 * Tokens are returned ONCE at creation and stored as SHA-256 hashes —
 * a database leak can never mint a working link. Consumption is
 * single-use and expiry-checked atomically (UPDATE … WHERE used_at IS
 * NULL AND expires_at > now).
 */

import "server-only";

import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/lib/turso/client";
import { emailTokens } from "@/lib/turso/schema";

export type EmailTokenType = "verify_email" | "password_reset";

const VERIFY_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const RESET_TTL_SECONDS = 60 * 60; // 1 hour

export const EMAIL_TOKEN_TTL: Record<EmailTokenType, number> = {
  verify_email: VERIFY_TTL_SECONDS,
  password_reset: RESET_TTL_SECONDS,
};

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a token for the user. Returns the RAW token (to embed in the
 * link) — the DB keeps only its hash. Existing unused tokens of the
 * same type are invalidated so only the newest link works.
 */
export async function createEmailToken(
  userId: string,
  type: EmailTokenType
): Promise<string> {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("base64url");

  // Invalidate older unused tokens of the same type for this user.
  const existing = await db
    .select({ id: emailTokens.id })
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.userId, userId),
        eq(emailTokens.type, type),
        isNull(emailTokens.usedAt)
      )
    );
  for (const row of existing) {
    await db
      .update(emailTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailTokens.id, row.id));
  }

  await db.insert(emailTokens).values({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL[type] * 1000),
  });

  return token;
}

export interface ConsumedToken {
  userId: string;
  type: EmailTokenType;
}

/**
 * Atomically consume a raw token: flips used_at only when it is still
 * unused and unexpired, then returns the owner. Single-use by contract.
 */
export async function consumeEmailToken(
  token: string,
  type: EmailTokenType
): Promise<ConsumedToken | null> {
  const db = getDb();
  const tokenHash = hashToken(token);

  const rows = await db
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailTokens.tokenHash, tokenHash),
        eq(emailTokens.type, type),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date())
      )
    )
    .returning({ userId: emailTokens.userId });

  return rows[0] ? { userId: rows[0].userId, type } : null;
}
