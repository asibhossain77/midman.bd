import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import { getDealForUser } from "@/lib/deals/queries";
import { requestRefund } from "@/lib/deals/service";
import { isSameOrigin } from "@/lib/http/same-origin";

export const dynamic = "force-dynamic";

/** POST /api/deals/[id]/refund — request a refund (admin processes it). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "forbidden" }, { status: 403 });
  }
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: auth.status });
  }

  const { id } = await params;
  const deal = await getDealForUser(id, auth.identity.user.id);
  if (!deal) {
    return NextResponse.json({ ok: false, error_key: "not_found" }, { status: 404 });
  }

  let reason = "";
  try {
    const body = (await request.json()) as { reason?: string };
    reason = typeof body.reason === "string" ? body.reason.slice(0, 2000) : "";
  } catch {
    reason = "";
  }

  const result = await requestRefund(id, auth.identity.user.id, reason);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error_key: result.code },
      { status: result.code === "not_found" ? 404 : 409 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
