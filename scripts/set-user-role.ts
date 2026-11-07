/**
 * Midman.bd — Promote or demote an account role DIRECTLY in the database.
 *
 * The public API never accepts a role — admins are minted here (or with
 * raw SQL). Usage:
 *
 *   bun scripts/set-user-role.ts <email> admin
 *   bun scripts/set-user-role.ts <email> user
 */

import { createClient } from "@libsql/client";

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !["admin", "user"].includes(role)) {
    console.error("Usage: bun scripts/set-user-role.ts <email> <admin|user>");
    process.exit(1);
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error("TURSO_DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = createClient({
    url,
    authToken: url.startsWith("file:") ? undefined : process.env.TURSO_AUTH_TOKEN,
  });

  const result = await client.execute({
    sql: "UPDATE users SET role = ?, updated_at = unixepoch() WHERE email = ?",
    args: [role, email.trim().toLowerCase()],
  });

  if (result.rowsAffected === 0) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  console.log(`✓ ${email} is now role="${role}"`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
