import { NextResponse } from "next/server";

import { getUserByEmail, isUserDatabaseConfigured } from "@/lib/auth/users";
import { createEmailToken } from "@/lib/auth/tokens";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { isEmailConfigured, passwordResetEmail, sendEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/http/same-origin";
import { consumeRateLimit, clientIp, AUTH_LIMITS } from "@/lib/http/rate-limit";
import { getSelfOrigin } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot-password.
 *
 * The response is ALWAYS ok (no account enumeration): the email is
 * sent only when the account exists, and the generic copy is identical
 * either way. Outside production builds the reset URL is returned so
 * local tests can complete the flow without SMTP.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 403 });
  }

  const rl = consumeRateLimit("forgot", clientIp(request), AUTH_LIMITS.perIp.limit, AUTH_LIMITS.perIp.windowMs);
  if (!rl.ok) {
    return NextResponse.json({ ok: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success || !isUserDatabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const row = await getUserByEmail(parsed.data.email);
  let devResetUrl: string | undefined;
  if (row && !row.disabledAt) {
    const token = await createEmailToken(row.id, "password_reset");
    const origin = await getSelfOrigin();
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    if (isEmailConfigured()) {
      const mail = passwordResetEmail(resetUrl);
      mail.to = row.email;
      await sendEmail(mail);
    } else if (process.env.NODE_ENV !== "production") {
      devResetUrl = resetUrl;
    }
  }

  return NextResponse.json({ ok: true, devResetUrl });
}
