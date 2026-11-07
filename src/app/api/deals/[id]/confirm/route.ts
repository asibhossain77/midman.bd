import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import { getDealForUser } from "@/lib/deals/queries";
import { confirmDeal } from "@/lib/deals/service";
import { isSameOrigin } from "@/lib/http/same-origin";

export const dynamic = "force-dynamic";

/** POST /api/deals/[id]/confirm — party action; the service enforces the state machine. */
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

  const result = await confirmDeal(id, auth.identity.user.id, undefined);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error_key: result.code },
      { status: result.code === "not_found" ? 404 : 409 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
