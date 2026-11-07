import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import { getDealForUser } from "@/lib/deals/queries";
import { submitPayment } from "@/lib/deals/service";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  clientIp,
  consumeRateLimit,
  PAYMENT_SUBMIT_LIMITS,
  refundRateLimit,
} from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/deals/[id]/payment — buyer records their payment.
 *
 * Duplicate protection: the client supplies an idempotency key; a
 * replayed submission with the SAME key returns success WITHOUT
 * recording money twice. A NEW submission while one is already
 * pending is refused by the state machine (status is no longer
 * "accepted").
 */
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

  const perUser = consumeRateLimit(
    "pay:user",
    auth.identity.user.id,
    PAYMENT_SUBMIT_LIMITS.perUser.limit,
    PAYMENT_SUBMIT_LIMITS.perUser.windowMs
  );
  if (!perUser.ok) {
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const deal = await getDealForUser(id, auth.identity.user.id);
  if (!deal) {
    return NextResponse.json({ ok: false, error_key: "not_found" }, { status: 404 });
  }

  let body: {
    methodId?: string;
    reference?: string;
    sender?: string | null;
    proofKey?: string | null;
    idempotencyKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    refundRateLimit("pay:user", auth.identity.user.id);
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const result = await submitPayment(id, auth.identity.user.id, {
    methodId: String(body.methodId ?? ""),
    reference: String(body.reference ?? ""),
    sender: body.sender ?? null,
    // proofKey comes ONLY from our own upload route (opaque key format).
    proofKey:
      typeof body.proofKey === "string" && /^proofs\/\d{4}\/[0-9a-f]{32}\.(jpe?g|png|webp)?$/.test(body.proofKey)
        ? body.proofKey
        : null,
    idempotencyKey:
      typeof body.idempotencyKey === "string" && body.idempotencyKey.length <= 64
        ? body.idempotencyKey
        : null,
  });

  if (!result.ok) {
    refundRateLimit("pay:user", auth.identity.user.id);
    return NextResponse.json(
      { ok: false, error_key: result.code },
      { status: result.code === "not_found" ? 404 : 409 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
