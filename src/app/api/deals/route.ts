import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import { createDeal } from "@/lib/deals/service";
import { isSameOrigin } from "@/lib/http/same-origin";
import {
  clientIp,
  consumeRateLimit,
  DEAL_CREATE_LIMITS,
  refundRateLimit,
} from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/deals — create a deal. The server derives both parties from
 * the authenticated actor + the counterparty's REGISTERED email; the
 * amount is re-validated against platform settings; status always starts
 * at pending_acceptance. Client-supplied status/fee/user ids do not exist.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "forbidden" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error_key: "unauthorized" },
      { status: auth.status }
    );
  }

  const ip = clientIp(request);
  const perUser = consumeRateLimit(
    "deal-create:user",
    auth.identity.user.id,
    DEAL_CREATE_LIMITS.perUser.limit,
    DEAL_CREATE_LIMITS.perUser.windowMs
  );
  const perIp = consumeRateLimit(
    "deal-create:ip",
    ip,
    DEAL_CREATE_LIMITS.perIp.limit,
    DEAL_CREATE_LIMITS.perIp.windowMs
  );
  if (!perUser.ok || !perIp.ok) {
    refundRateLimit("deal-create:user", auth.identity.user.id);
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  let body: {
    title?: string;
    description?: string | null;
    terms?: string | null;
    amount?: number;
    counterpartyEmail?: string;
    createdByRole?: string;
    idempotencyKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const createdByRole =
    body.createdByRole === "seller" ? "seller" : ("buyer" as const);

  const result = await createDeal({
    actorId: auth.identity.user.id,
    actorEmailVerified: auth.identity.emailVerifiedAt !== null,
    title: String(body.title ?? ""),
    description: body.description ?? null,
    terms: body.terms ?? null,
    amount: Number(body.amount),
    counterpartyEmail: String(body.counterpartyEmail ?? ""),
    createdByRole,
    idempotencyKey:
      typeof body.idempotencyKey === "string" && body.idempotencyKey.length <= 64
        ? body.idempotencyKey
        : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error_key: result.code },
      { status: result.code === "counterparty_not_found" ? 404 : 400 }
    );
  }

  return NextResponse.json(
    { ok: true, dealId: result.data.dealId, code: result.data.code },
    { status: 201 }
  );
}
