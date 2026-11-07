import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { getSelfOrigin, GOOGLE_FLOW_COOKIE_NAME, GOOGLE_FLOW_MAX_AGE_SECONDS } from "@/lib/auth/config";
import {
  buildGoogleAuthorizeUrl,
  createPkcePair,
  encodeOAuthFlow,
  getGoogleOAuthConfig,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/**
 * GET /auth/google — start the OAuth flow (PKCE S256). The state +
 * verifier ride in an HttpOnly flow cookie; nothing about the flow is
 * stored server-side.
 */
export async function GET(request: NextRequest) {
  const origin = await getSelfOrigin();
  const config = getGoogleOAuthConfig(origin);
  if (!config) {
    return NextResponse.redirect(`${origin}/login?error=google_not_configured`);
  }

  const { state, verifier, challenge } = createPkcePair();
  const authorizeUrl = buildGoogleAuthorizeUrl(config, state, challenge);

  const store = await cookies();
  store.set(GOOGLE_FLOW_COOKIE_NAME, encodeOAuthFlow({ state, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: GOOGLE_FLOW_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(authorizeUrl);
}
