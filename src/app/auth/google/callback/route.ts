import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import {
  getSelfOrigin,
  GOOGLE_FLOW_COOKIE_NAME,
  sanitizeNextPath,
} from "@/lib/auth/config";
import {
  decodeOAuthFlow,
  exchangeGoogleCode,
  fetchGoogleIdentity,
  getGoogleOAuthConfig,
  safeEqual,
} from "@/lib/auth/google";
import { setSessionCookie } from "@/lib/auth/session";
import { upsertGoogleUser, touchLastLogin } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

/**
 * GET /auth/google/callback — validate state (timing-safe against the
 * HttpOnly flow cookie), exchange the code server-side, resolve the
 * identity, create-or-LINK the users row, and issue the platform's own
 * signed session. Failures redirect to /login?error=… (never a token).
 */
export async function GET(request: NextRequest) {
  const origin = await getSelfOrigin();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  const fail = (reason: string) => {
    const target = new URL("/login", origin);
    target.searchParams.set("error", reason);
    return NextResponse.redirect(target.toString());
  };

  if (providerError) return fail("callback_failed");

  const store = await cookies();
  const flow = decodeOAuthFlow(store.get(GOOGLE_FLOW_COOKIE_NAME)?.value);
  store.set(GOOGLE_FLOW_COOKIE_NAME, "", { maxAge: 0, path: "/" });

  if (!flow || !code || !state || !safeEqual(flow.state, state)) {
    return fail("invalid_state");
  }

  const config = getGoogleOAuthConfig(origin);
  if (!config) return fail("google_not_configured");

  const token = await exchangeGoogleCode(config, code, flow.verifier);
  if (!token.ok) return fail("token_exchange_failed");

  const identity = await fetchGoogleIdentity(config, token.accessToken);
  if (!identity.identity) return fail("identity_unavailable");

  const user = await upsertGoogleUser({
    sub: identity.identity.sub,
    name: identity.identity.name,
    email: identity.identity.email,
    avatarUrl: identity.identity.avatarUrl,
  });
  if (user.disabledAt) return fail("callback_failed");

  await touchLastLogin(user.id);

  // Restore the pre-login `next` target if it was stashed in the state.
  const next = sanitizeNextPath(url.searchParams.get("next"));
  const response = NextResponse.redirect(`${origin}${next ?? "/dashboard"}`);
  setSessionCookie(
    response,
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role === "admin" ? "admin" : "user",
      avatarUrl: user.avatarUrl,
    },
    origin
  );
  return response;
}
