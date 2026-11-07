import { NextResponse } from "next/server";

import { resolveIdentity } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session — the header widget's single source of truth.
 * Identity is resolved from the signed cookie AND re-checked against
 * the users row (role changes apply without re-login).
 */
export async function GET() {
  const identity = await resolveIdentity();
  if (!identity) {
    return NextResponse.json({ authenticated: false, user: null });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: identity.user.id,
      name: identity.user.name,
      email: identity.user.email,
      role: identity.user.role,
      avatar_url: identity.user.avatarUrl,
      email_verified: identity.emailVerifiedAt !== null,
    },
  });
}
