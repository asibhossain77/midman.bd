import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/auth/admin";
import { markPayoutPaid } from "@/lib/deals/service";
import { isSameOrigin } from "@/lib/http/same-origin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/deals/[id]/payout — release the seller payout.
 * Eligibility (completed + no dispute/refund + not already paid) is
 * enforced server-side; the idempotency key "deal:<id>:payout" means a
 * retried call can never double-pay.
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
  let reference: string | undefined;
  try {
    const body = (await request.json()) as { reference?: string };
    reference = body.reference;
  } catch {
    reference = undefined;
  }

  const result = await markPayoutPaid(id, auth.identity.user.id, reference);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error_key: result.code },
      { status: result.code === "not_found" ? 404 : 409 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
