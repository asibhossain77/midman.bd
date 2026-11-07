import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/auth/admin";
import { resolveDispute, type DisputeResolution } from "@/lib/deals/service";
import { isSameOrigin } from "@/lib/http/same-origin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/disputes/[id] — resolve an open dispute.
 * resolution: "refund_to_buyer" | "complete" | "resume". While open,
 * NOTHING else can complete or pay out — this endpoint is the only exit.
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
  let resolution = "";
  let note: string | undefined;
  try {
    const body = (await request.json()) as { resolution?: string; note?: string };
    resolution = body.resolution ?? "";
    note = body.note;
  } catch {
    resolution = "";
  }

  if (!["refund_to_buyer", "complete", "resume"].includes(resolution)) {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const result = await resolveDispute(
    id,
    auth.identity.user.id,
    resolution as DisputeResolution,
    note
  );
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error_key: result.code },
      { status: result.code === "not_found" ? 404 : 409 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
