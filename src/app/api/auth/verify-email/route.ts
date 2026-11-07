import { NextResponse } from "next/server";

import { consumeEmailToken } from "@/lib/auth/tokens";
import { getUserById, markEmailVerified } from "@/lib/auth/users";
import { consumeRateLimit, clientIp } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/auth/verify-email — consume a one-time verification token. */
export async function POST(request: Request) {
  const rl = consumeRateLimit("verify-email", clientIp(request), 20, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 400 });
  }

  if (!body.token || typeof body.token !== "string") {
    return NextResponse.json({ ok: false, error_key: "token_missing" }, { status: 400 });
  }

  const consumed = await consumeEmailToken(body.token, "verify_email");
  if (!consumed) {
    return NextResponse.json({ ok: false, error_key: "weak_token" }, { status: 400 });
  }

  await markEmailVerified(consumed.userId);
  const user = await getUserById(consumed.userId);
  if (user && !user.emailVerifiedAt) {
    // markEmailVerified uses WHERE email_verified_at IS NULL; a second
    // token replay is a no-op — fine by design.
  }
  return NextResponse.json({ ok: true });
}
