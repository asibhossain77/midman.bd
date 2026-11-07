/**
 * Midman.bd — Server-side privilege guards.
 *
 * `requireSession()` and `requireAdmin()` are the ONLY sanctioned way
 * for pages and API routes to obtain a privileged identity. Both
 * re-derive the role from the DB row (not the signed cookie), so a
 * role change applies immediately — the cookie is never trusted for
 * authorization by itself.
 */

import "server-only";

import { redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "./session";
import { getUserById } from "./users";
import { isAdminRole, toUserRole, type UserRole } from "./roles";
import { sanitizeNextPath } from "./config";

export interface ResolvedIdentity {
  user: SessionUser;
  role: UserRole;
  emailVerifiedAt: Date | null;
}

/**
 * Refresh the cookie identity against the DB row. Returns null when
 * the cookie is missing, the account row is gone, or the account is
 * disabled.
 */
export async function resolveIdentity(): Promise<ResolvedIdentity | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const row = await getUserById(session.id);
  if (!row || row.disabledAt) return null;

  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: toUserRole(row.role),
      avatarUrl: row.avatarUrl,
    },
    role: toUserRole(row.role),
    emailVerifiedAt: row.emailVerifiedAt,
  };
}

/** Page-level guard: redirects anonymous visitors to /login?next=… */
export async function requirePageUser(): Promise<ResolvedIdentity> {
  const identity = await resolveIdentity();
  if (!identity) {
    const { headers } = await import("next/headers");
    const h = await headers();
    const path = h.get("x-mb-pathname") ?? "/";
    const next = sanitizeNextPath(path);
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return identity;
}

/** Page-level admin guard: non-admins land on the site home page. */
export async function requirePageAdmin(): Promise<ResolvedIdentity> {
  const identity = await requirePageUser();
  if (!isAdminRole(identity.role)) {
    redirect("/");
  }
  return identity;
}

/** API-level guard: 401 when anonymous. */
export async function requireApiUser(): Promise<
  { ok: true; identity: ResolvedIdentity } | { ok: false; status: 401 }
> {
  const identity = await resolveIdentity();
  if (!identity) return { ok: false, status: 401 };
  return { ok: true, identity };
}

/** API-level admin guard: 401 anonymous, 403 authenticated non-admin. */
export async function requireApiAdmin(): Promise<
  { ok: true; identity: ResolvedIdentity } | { ok: false; status: 401 | 403 }
> {
  const result = await requireApiUser();
  if (!result.ok) return result;
  if (!isAdminRole(result.identity.role)) return { ok: false, status: 403 };
  return result;
}
