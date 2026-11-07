import { NextResponse } from "next/server";

import { getSelfOrigin } from "@/lib/auth/config";
import { setSessionCookie } from "@/lib/auth/session";
import { createUser, isUserDatabaseConfigured, touchLastLogin } from "@/lib/auth/users";
import { registerSchema, fieldErrors } from "@/lib/auth/validation";
import { isSameOrigin } from "@/lib/http/same-origin";
import { consumeRateLimit, refundRateLimit, clientIp, AUTH_LIMITS } from "@/lib/http/rate-limit";
import { createEmailToken } from "@/lib/auth/tokens";
import { isEmailConfigured, sendEmail, verificationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register — create an account (manual flow).
 *
 * The role field does NOT exist in the schema: every self-registered
 * account is a plain "user". A session is issued immediately; the
 * email stays unverified until the emailed token is consumed. When
 * email delivery is unconfigured OUTSIDE production the verification
 * URL is returned so local tests can complete the flow.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 403 });
  }

  const ip = clientIp(request);
  const rl = consumeRateLimit("register", ip, AUTH_LIMITS.perIp.limit, AUTH_LIMITS.perIp.windowMs);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    refundRateLimit("register", ip);
    return NextResponse.json(
      { ok: false, error_key: "validation_failed", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  if (!isUserDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error_key: "db_unavailable" }, { status: 503 });
  }

  const { name, email, password } = parsed.data;
  const result = await createUser({ name, email, password });
  if (!result.ok) {
    refundRateLimit("register", ip);
    return NextResponse.json({ ok: false, error_key: "email_taken" }, { status: 409 });
  }

  const user = result.user;

  // Verification email — token consumed at /verify-email?token=…
  let devVerifyUrl: string | undefined;
  try {
    const token = await createEmailToken(user.id, "verify_email");
    const origin = await getSelfOrigin();
    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
    if (isEmailConfigured()) {
      const mail = verificationEmail(user.name, verifyUrl);
      mail.to = user.email;
      await sendEmail(mail);
    } else if (process.env.NODE_ENV !== "production") {
      devVerifyUrl = verifyUrl;
    }
  } catch (error) {
    console.error("[auth] verification email failed:", error);
  }

  const origin = await getSelfOrigin();
  const response = NextResponse.json(
    { ok: true, user: { id: user.id, name: user.name, email: user.email }, devVerifyUrl },
    { status: 201 }
  );
  setSessionCookie(
    response,
    { id: user.id, name: user.name, email: user.email, role: "user", avatarUrl: user.avatarUrl },
    origin
  );
  await touchLastLogin(user.id);
  return response;
}
