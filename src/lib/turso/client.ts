/**
 * Midman.bd — Turso (libSQL) client.
 *
 * The escrow platform keeps ALL of its application data in a dedicated
 * Turso database — completely separate from the Midman Verify database
 * and from any other Midman production database. Nothing is shared
 * except the design language and the brand.
 *
 * Server-side only. Never import this file from a client component.
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

let client: Client | null = null;
let db: ReturnType<typeof createDb> | null = null;

function createClientFromEnv(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Turso credentials."
    );
  }

  // Local file databases don't need an auth token; remote Turso DBs do.
  const isLocal = url.startsWith("file:");

  return createClient({
    url,
    authToken: isLocal ? undefined : authToken,
  });
}

function createDb(client: Client) {
  return drizzle(client, { schema });
}

/**
 * Honest "is the Midman.bd database configured?" check for status
 * surfaces. Pure env inspection — never throws, never creates a
 * client, safe at build time.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

/**
 * Lazy singleton — the client is only created the first time it is used,
 * so importing this module never crashes at build time when env vars are
 * absent (e.g. during `next build` on Vercel preview without env setup).
 */
export function getTursoClient(): Client {
  if (!client) {
    client = createClientFromEnv();
  }
  return client;
}

/**
 * Drizzle ORM instance bound to the Turso client.
 * Usage: `const db = getDb(); db.select().from(users)…`
 */
export function getDb() {
  if (!db) {
    db = createDb(getTursoClient());
  }
  return db;
}

export { schema };
export type Database = ReturnType<typeof createDb>;
