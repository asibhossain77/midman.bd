import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import { getUserById } from "@/lib/auth/users";
import { createEmailToken } from "@/lib/auth/tokens";
import { getSelfOrigin } from "@/lib/auth/config";
import { isEmailConfigured, sendEmail, verificationEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/resend-verification — mint + send a fresh email
 * verification token for the signed-in, still-unverified account.
 * Rate-limited per user (5/hour). The dev URL leaks ONLY outside
 * production builds with email unconfigured.
 */
export async function POST() {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: auth.status });
  }

  const rl = consumeRateLimit("resend-verify", auth.identity.user.id, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  const row = await getUserById(auth.identity.user.id);
  if (!row || row.emailVerifiedAt) {
    return NextResponse.json({ ok: false, error_key: "invalid_state" }, { status: 409 });
  }

  const token = await createEmailToken(row.id, "verify_email");
  const origin = await getSelfOrigin();
  const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;

  if (isEmailConfigured()) {
    const mail = verificationEmail(row.name, verifyUrl);
    mail.to = row.email;
    await sendEmail(mail);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({
    ok: true,
    ...(process.env.NODE_ENV !== "production" ? { devVerifyUrl: verifyUrl } : {}),
  });
}
