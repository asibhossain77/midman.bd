/**
 * Midman.bd — Migration runner.
 *
 * Applies every SQL file in scripts/migrations/ (sorted by filename) to
 * the configured Turso database, exactly once each. Applied filenames
 * are tracked in the `_migrations` table, so the runner is IDEMPOTENT:
 * re-running it never re-applies or destroys anything.
 *
 * Usage: bun scripts/apply-migrations.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";

/**
 * Strip `--` comment lines from a chunk and return the executable
 * statement (a chunk may BEGIN with comments and still carry a real
 * statement — comments are line-level, not chunk-level).
 */
function toExecutable(chunk: string): string | null {
  const lines = chunk
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"));
  const statement = lines.join("\n").trim();
  return statement.length > 0 ? statement : null;
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error("TURSO_DATABASE_URL is not set — copy .env.example to .env.local first.");
    process.exit(1);
  }

  const client = createClient({
    url,
    authToken: url.startsWith("file:") ? undefined : process.env.TURSO_AUTH_TOKEN,
  });

  // Registry table itself (idempotent).
  await client.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
       filename TEXT PRIMARY KEY,
       applied_at INTEGER NOT NULL DEFAULT (unixepoch())
     );`
  );

  const dir = path.join(process.cwd(), "scripts", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (await client.execute("SELECT filename FROM _migrations")).rows.map(
      (r) => String(r.filename)
    )
  );

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");

    const statements = sql
      .split(";")
      .map(toExecutable)
      .filter((s): s is string => s !== null);

    try {
      for (const statement of statements) {
        await client.execute(statement);
      }
    } catch (error) {
      console.error(`✗ ${file} failed.`);
      console.error("  Statement:", statements[0]?.slice(0, 80));
      throw error;
    }
    await client.execute({
      sql: "INSERT INTO _migrations (filename) VALUES (?);",
      args: [file],
    });
    console.log(`✓ applied ${file}`);
    ran += 1;
  }

  if (ran === 0) console.log("No pending migrations — database is up to date.");
  console.log(`Done. ${ran} migration(s) applied, ${files.length} tracked total.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
