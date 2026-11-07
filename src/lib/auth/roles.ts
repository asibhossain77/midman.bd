/**
 * Midman.bd — User roles (single source of truth).
 *
 *   user   — default for EVERY self-registered account
 *   admin  — full access to the /admin panel (server-side enforced)
 *
 * HOW AN ACCOUNT BECOMES AN ADMIN
 * -------------------------------
 * NEVER through the public register/login flow — the API schemas do not
 * even accept a role field. An operator promotes an account DIRECTLY in
 * the database:
 *
 *   bun scripts/set-user-role.ts <email> admin   (helper script)
 *   UPDATE users SET role='admin' WHERE email='…';  (raw SQL)
 *
 * Role changes take effect on the affected user's NEXT request — the
 * identity resolution re-reads the users row, so no re-login is needed.
 *
 * This module is intentionally dependency-free (no "server-only") so
 * scripts and edge-adjacent code can share the exact same union.
 */

export const USER_ROLES = ["user", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Every self-registered account starts here. */
export const DEFAULT_USER_ROLE: UserRole = "user";

/** Type guard — anything unknown/unmapped collapses to a safe "user". */
export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

/** Normalize an untrusted storage value into a known role. */
export function toUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : DEFAULT_USER_ROLE;
}

/** Whether this role may open the /admin panel (server-side enforced). */
export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}
