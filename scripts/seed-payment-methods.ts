/**
 * Seed the default buyer payment channels (admin does this via the
 * settings UI in production). Idempotent: skips when any channel exists.
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error("TURSO_DATABASE_URL is not set.");
    process.exit(1);
  }
  const client = createClient({
    url,
    authToken: url.startsWith("file:") ? undefined : process.env.TURSO_AUTH_TOKEN,
  });

  const existing = await client.execute("SELECT count(*) as c FROM payment_methods");
  if (Number(existing.rows[0]?.c ?? 0) > 0) {
    console.log("Payment methods already present — skipping seed.");
    process.exit(0);
  }

  const methods = [
    {
      name: "bKash (Merchant)",
      account: "01700-000000",
      instructions:
        "Send Money to this bKash merchant number and use the deal code as the reference. ডিল কোড রেফারেন্স হিসেবে ব্যবহার করুন।",
    },
    {
      name: "Nagad",
      account: "01800-000000",
      instructions:
        "Send Money to this Nagad number with the deal code as reference.",
    },
  ];

  for (const m of methods) {
    await client.execute({
      sql: "INSERT INTO payment_methods (id, name, account, instructions, is_active, sort_order) VALUES (?, ?, ?, ?, 1, ?)",
      args: [crypto.randomUUID(), m.name, m.account, m.instructions, 0],
    });
  }
  console.log(`Seeded ${methods.length} payment methods.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
