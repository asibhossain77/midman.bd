import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import { getUserById, updatePassword } from "@/lib/auth/users";
import { changePasswordSchema } from "@/lib/auth/validation";
import { verifyPassword } from "@/lib/auth/password";
import { isSameOrigin } from "@/lib/http/same-origin";
import { consumeRateLimit, AUTH_LIMITS } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/password — change the account password.
 * Google-only accounts have an unusable random hash; changing the
 * password here SETS a real one (documented behavior).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "forbidden" }, { status: 403 });
  }
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: auth.status });
  }

  const rl = consumeRateLimit(
    "chpass",
    auth.identity.user.id,
    AUTH_LIMITS.perIp.limit,
    AUTH_LIMITS.perIp.windowMs
  );
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error_key: "password_short" }, { status: 400 });
  }

  const row = await getUserById(auth.identity.user.id);
  if (!row) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: 401 });
  }

  // Timing-safe current-password check (dummy-hash for Google-only rows).
  const ok = verifyPassword(parsed.data.currentPassword, row.passwordHash);
  if (!ok) {
    return NextResponse.json({ ok: false, error_key: "invalid_credentials" }, { status: 403 });
  }
  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return NextResponse.json({ ok: false, error_key: "same_password" }, { status: 400 });
  }

  await updatePassword(auth.identity.user.id, parsed.data.newPassword);
  return NextResponse.json({ ok: true });
}
