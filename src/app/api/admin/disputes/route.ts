import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/auth/admin";
import { listDisputes } from "@/lib/deals/queries";

export const dynamic = "force-dynamic";

/** GET /api/admin/disputes — the dispute queue (open by default). */
export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error_key: auth.status === 401 ? "unauthorized" : "forbidden" },
      { status: auth.status }
    );
  }
  const url = new URL(request.url);
  const openOnly = url.searchParams.get("all") !== "1";
  const items = await listDisputes(openOnly);
  return NextResponse.json({ ok: true, items });
}
