import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/auth/admin";
import { rejectPayment, verifyPayment } from "@/lib/deals/service";
import { isSameOrigin } from "@/lib/http/same-origin";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/deals/[id]/payment — admin verifies or rejects the
 * buyer's submitted payment. `action: "verify" | "reject"`.
 * Verifying is the ONLY path that marks money as secured.
 */
export async function POST(
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
  let action = "";
  let note: string | undefined;
  try {
    const body = (await request.json()) as { action?: string; note?: string };
    action = body.action ?? "";
    note = body.note;
  } catch {
    action = "";
  }

  const result =
    action === "verify"
      ? await verifyPayment(id, auth.identity.user.id)
      : action === "reject"
        ? await rejectPayment(id, auth.identity.user.id, note)
        : { ok: false as const, code: "invalid_input" as const };

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error_key: result.code },
      { status: result.code === "not_found" ? 404 : 409 }
    );
  }

  await recordAudit({
    actorId: auth.identity.user.id,
    action: action === "verify" ? "payment.verify" : "payment.reject",
    targetType: "deal",
    targetId: id,
  });
  return NextResponse.json({ ok: true, data: result.data });
}
