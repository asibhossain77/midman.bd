import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireApiAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/turso/client";
import { paymentMethods } from "@/lib/turso/schema";
import { recordAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/http/same-origin";

export const dynamic = "force-dynamic";

/** PATCH — toggle/rename a payment channel (audited). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  let body: { isActive?: boolean; name?: string; account?: string; instructions?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const db = getDb();
  const patch: Partial<typeof paymentMethods.$inferInsert> = {};
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.account === "string" && body.account.trim()) patch.account = body.account.trim();
  if (body.instructions !== undefined) patch.instructions = body.instructions?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  await db.update(paymentMethods).set(patch).where(eq(paymentMethods.id, id));
  await recordAudit({
    actorId: auth.identity.user.id,
    action: "payment_method.update",
    targetType: "payment_method",
    targetId: id,
    meta: patch as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true });
}

/** DELETE — remove a payment channel (audited). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const db = getDb();
  await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
  await recordAudit({
    actorId: auth.identity.user.id,
    action: "payment_method.delete",
    targetType: "payment_method",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
