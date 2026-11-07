import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/turso/client";

export const dynamic = "force-dynamic";

/** GET /api/health — honest status surface (no secrets, no PII). */
export async function GET() {
  let db = "not_configured";
  if (isDatabaseConfigured()) {
    try {
      const { getTursoClient } = await import("@/lib/turso/client");
      await getTursoClient().execute("select 1");
      db = "ok";
    } catch {
      db = "unreachable";
    }
  }
  return NextResponse.json({
    status: "ok",
    service: "midman-bd",
    database: db,
    time: new Date().toISOString(),
  });
}
