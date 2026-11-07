import { NextResponse } from "next/server";

import { getSelfOrigin } from "@/lib/auth/config";
import { setSessionCookie } from "@/lib/auth/session";
import { authenticateByEmail, isUserDatabaseConfigured, touchLastLogin } from "@/lib/auth/users";
import { fieldErrors, loginSchema } from "@/lib/auth/validation";
import { isSameOrigin } from "@/lib/http/same-origin";
import { consumeRateLimit, clientIp, AUTH_LIMITS } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login — manual email + password sign-in.
 *
 * Timing note: unknown emails still run ONE bcrypt comparison (against
 * a dummy hash) so response time cannot reveal whether an account
 * exists. Errors never disclose which field was wrong.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 403 });
  }

  const ip = clientIp(request);
  const rl = consumeRateLimit("login", ip, AUTH_LIMITS.perIp.limit, AUTH_LIMITS.perIp.windowMs);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_key: "validation_failed", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  if (!isUserDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error_key: "db_unavailable" }, { status: 503 });
  }

  const { email, password } = parsed.data;

  try {
    const row = await authenticateByEmail(email, password);
    if (!row) {
      return NextResponse.json(
        { ok: false, error_key: "invalid_credentials" },
        { status: 401 }
      );
    }

    const origin = await getSelfOrigin();
    const response = NextResponse.json(
      {
        ok: true,
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          email_verified: Boolean(row.emailVerifiedAt),
        },
        redirect: "/dashboard",
      },
      { status: 200 }
    );
    setSessionCookie(
      response,
      {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role === "admin" ? "admin" : "user",
        avatarUrl: row.avatarUrl ?? null,
      },
      origin
    );

    await touchLastLogin(row.id);
    return response;
  } catch (error) {
    console.error("[auth] login failed:", error);
    return NextResponse.json({ ok: false, error_key: "generic" }, { status: 500 });
  }
}
