/**
 * Midman.bd — User queries.
 *
 * All user-row access goes through this module: registration, identity
 * refresh, Google linking, verification flips, profile updates and the
 * admin user list. Server-side only.
 */

import "server-only";

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/lib/turso/client";
import { users } from "@/lib/turso/schema";
import { hashPassword, verifyPassword } from "./password";
import { DEFAULT_USER_ROLE, type UserRole } from "./roles";

export type UserRow = typeof users.$inferSelect;

export { isDatabaseConfigured as isUserDatabaseConfigured };

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Create a local account for the manual register flow. The email is
 * normalized to lower-case; a duplicate is reported so the UI can hint
 * at logging in instead.
 */
export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true; user: UserRow } | { ok: false; reason: "email_taken" }> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  try {
    const rows = await db
      .insert(users)
      .values({
        name: input.name.trim(),
        email,
        passwordHash: hashPassword(input.password),
        role: DEFAULT_USER_ROLE,
      })
      .returning();
    return { ok: true, user: rows[0] };
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint failed: users\.email/i.test(error.message)
    ) {
      return { ok: false, reason: "email_taken" };
    }
    throw error;
  }
}

/**
 * Google create-or-LINK: google_id match signs in; else the matching
 * email row gains the google_id (role/password untouched — a Google
 * login never changes DB roles, never breaks manual login); else a new
 * row is created with a random password hash (never usable for login).
 */
export async function upsertGoogleUser(input: {
  sub: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}): Promise<UserRow> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const byGoogle = await db
    .select()
    .from(users)
    .where(eq(users.googleId, input.sub))
    .limit(1);
  if (byGoogle[0]) return byGoogle[0];

  const byEmail = await getUserByEmail(email);
  if (byEmail) {
    const rows = await db
      .update(users)
      .set({ googleId: input.sub, updatedAt: new Date() })
      .where(eq(users.id, byEmail.id))
      .returning();
    return rows[0];
  }

  const randomHash = hashPassword(crypto.randomUUID() + crypto.randomUUID());
  const rows = await db
    .insert(users)
    .values({
      name: input.name.trim() || email.split("@")[0],
      email,
      passwordHash: randomHash,
      role: DEFAULT_USER_ROLE,
      googleId: input.sub,
      avatarUrl: input.avatarUrl,
      emailVerifiedAt: new Date(),
    })
    .returning();
  return rows[0];
}

export async function touchLastLogin(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function markEmailVerified(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, id), isNull(users.emailVerifiedAt)));
}

export async function updatePassword(
  id: string,
  newPassword: string
): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function updateProfile(
  id: string,
  input: { name?: string; avatarUrl?: string | null }
): Promise<void> {
  const db = getDb();
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
  await db.update(users).set(patch).where(eq(users.id, id));
}

/** Admin identity refresh — used by privileged pages. */
export async function getFreshUserRole(id: string): Promise<UserRole> {
  const row = await getUserById(id);
  return row ? (row.role as UserRole) : DEFAULT_USER_ROLE;
}

/** Admin users list with per-user deal counts. */
export async function listUsersForAdmin(search: string | null) {
  const db = getDb();
  const term = search?.trim().toLowerCase() ?? "";

  const base = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
      dealCount: sql<number>`(
        select count(*) from deals d
        where d.buyer_id = ${users.id} or d.seller_id = ${users.id}
      )`.as("deal_count"),
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(200);

  if (!term) return base;
  return base.where(
    or(
      sql`lower(${users.name}) like ${`%${term}%`}`,
      sql`lower(${users.email}) like ${`%${term}%`}`
    )
  );
}

/** Whether this account can authenticate at all (exists + not disabled). */
export function isUsableRow(
  row: UserRow | null,
  passwordOk: boolean
): row is UserRow {
  return Boolean(row && !row.disabledAt && passwordOk);
}

/** Timing-safe manual login check used by the login route. */
export async function authenticateByEmail(
  email: string,
  password: string
): Promise<UserRow | null> {
  const row = await getUserByEmail(email);
  const ok = verifyPassword(password, row?.passwordHash ?? null);
  return isUsableRow(row, ok) ? row : null;
}
