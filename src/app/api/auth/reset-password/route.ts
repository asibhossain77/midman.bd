import { NextResponse } from "next/server";

import { consumeEmailToken } from "@/lib/auth/tokens";
import { updatePassword } from "@/lib/auth/users";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { isSameOrigin } from "@/lib/http/same-origin";
import { consumeRateLimit, clientIp, AUTH_LIMITS } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/auth/reset-password — consume a reset token, set a new password. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 403 });
  }

  const rl = consumeRateLimit("reset", clientIp(request), AUTH_LIMITS.perIp.limit, AUTH_LIMITS.perIp.windowMs);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error_key: "weak_token" }, { status: 400 });
  }

  const consumed = await consumeEmailToken(parsed.data.token, "password_reset");
  if (!consumed) {
    return NextResponse.json({ ok: false, error_key: "weak_token" }, { status: 400 });
  }

  await updatePassword(consumed.userId, parsed.data.password);
  return NextResponse.json({ ok: true });
}
