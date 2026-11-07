import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { requireApiAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/turso/client";
import { paymentMethods } from "@/lib/turso/schema";
import { recordAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/http/same-origin";

export const dynamic = "force-dynamic";

/** GET — list all payment channels (admin). */
export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error_key: auth.status === 401 ? "unauthorized" : "forbidden" },
      { status: auth.status }
    );
  }
  const db = getDb();
  const items = await db.select().from(paymentMethods).orderBy(paymentMethods.sortOrder);
  return NextResponse.json({ ok: true, items });
}

/** POST — add a payment channel (audited). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "forbidden" }, { status: 403 });
  }
  const auth = await requireApiAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error_key: auth.status === 401 ? "unauthorized" : "forbidden" },
      { status: auth.status }
    );
  }

  let body: { name?: string; account?: string; instructions?: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const account = (body.account ?? "").trim();
  if (name.length < 1 || name.length > 60 || account.length < 1 || account.length > 120) {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const db = getDb();
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${paymentMethods.sortOrder}), 0)` })
    .from(paymentMethods);

  const rows = await db
    .insert(paymentMethods)
    .values({
      name,
      account,
      instructions: body.instructions?.trim() || null,
      sortOrder: Number(body.sortOrder ?? maxOrder + 1),
    })
    .returning();

  await recordAudit({
    actorId: auth.identity.user.id,
    action: "payment_method.create",
    targetType: "payment_method",
    targetId: rows[0].id,
    meta: { name, account },
  });
  return NextResponse.json({ ok: true, item: rows[0] }, { status: 201 });
}
