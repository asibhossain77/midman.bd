/**
 * Midman.bd — Google OAuth client ("Continue with Google").
 *
 * ARCHITECTURE (active only when GOOGLE_OAUTH_CLIENT_ID + SECRET are set):
 *
 *   /auth/google          → 302 accounts.google.com with client_id,
 *                            redirect_uri, state + PKCE S256 challenge
 *   accounts.google.com   → Google sign-in + consent (Google's session)
 *   /auth/google/callback → state validated (timing-safe, HttpOnly flow
 *                            cookie) → code exchanged SERVER-side →
 *                            profile read from userinfo (Bearer) →
 *                            create-or-LINK the users row (google_id,
 *                            then email) → Midman.bd's signed session.
 *
 * SECRETS: the client secret is used ONLY inside the server-to-server
 * token exchange — it never reaches the browser or the client bundle.
 */

import "server-only";

import crypto from "node:crypto";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  prompt: string | null;
  redirectUri: string;
}

export function getGoogleClientId(): string | null {
  return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null;
}

function getGoogleClientSecret(): string | null {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null;
}

/** Both id AND secret must exist, or the flow would fail closed at Google. */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

function overrideOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  try {
    return new URL(trimmed).toString();
  } catch {
    console.warn(`[auth:google] ${value} is not an absolute URL — using default.`);
    return fallback;
  }
}

export function getGoogleOAuthConfig(origin: string): GoogleOAuthConfig | null {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    authorizationUrl: overrideOr(
      process.env.GOOGLE_OAUTH_AUTHORIZATION_URL,
      "https://accounts.google.com/o/oauth2/v2/auth"
    ),
    tokenUrl: overrideOr(
      process.env.GOOGLE_OAUTH_TOKEN_URL,
      "https://oauth2.googleapis.com/token"
    ),
    userinfoUrl: overrideOr(
      process.env.GOOGLE_OAUTH_USERINFO_URL,
      "https://openidconnect.googleapis.com/v1/userinfo"
    ),
    scope: process.env.GOOGLE_OAUTH_SCOPE?.trim() || "openid email profile",
    prompt: process.env.GOOGLE_OAUTH_PROMPT?.trim() || null,
    // Built server-side from the pinned origin — never from user input.
    // THIS exact URL must be registered in Google Cloud Console.
    redirectUri: `${origin}/auth/google/callback`,
  };
}

/* ------------------------- Flow state (PKCE) ------------------------ */

export interface OAuthFlow {
  state: string;
  verifier: string;
}

export function createPkcePair(): { state: string; verifier: string; challenge: string } {
  const state = crypto.randomBytes(24).toString("base64url");
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

/** Encode the pending flow into the HttpOnly cookie value. */
export function encodeOAuthFlow(flow: OAuthFlow): string {
  return Buffer.from(JSON.stringify(flow)).toString("base64url");
}

export function decodeOAuthFlow(value: string | undefined): OAuthFlow | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as OAuthFlow;
    if (!parsed.state || !parsed.verifier) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* --------------------------- Authorize URL -------------------------- */

function encodeQueryPair(key: string, value: string): string {
  return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function buildGoogleAuthorizeUrl(
  config: GoogleOAuthConfig,
  state: string,
  challenge: string
): string {
  const pairs: string[] = [
    encodeQueryPair("client_id", config.clientId),
    encodeQueryPair("redirect_uri", config.redirectUri),
    encodeQueryPair("response_type", "code"),
    encodeQueryPair("scope", config.scope),
    encodeQueryPair("state", state),
    encodeQueryPair("code_challenge", challenge),
    encodeQueryPair("code_challenge_method", "S256"),
    // Confidential client, no refresh token — one-off code only.
    encodeQueryPair("access_type", "online"),
  ];
  if (config.prompt) pairs.push(encodeQueryPair("prompt", config.prompt));
  const url = new URL(config.authorizationUrl);
  url.search = pairs.join("&");
  return url.toString();
}

/* ------------------------- Token + identity ------------------------- */

export type GoogleTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; errorCode: string };

export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
  verifier: string
): Promise<GoogleTokenResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: verifier,
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "midman-bd-google-oauth/1.0",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!res) return { ok: false, errorCode: "network_error" };

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, errorCode: `http_${res.status}` };
  }

  if (!res.ok) {
    const errorCode =
      typeof json.error === "string" ? json.error : `http_${res.status}`;
    return { ok: false, errorCode };
  }

  const accessToken = json.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return { ok: false, errorCode: "invalid_token_response" };
  }
  return { ok: true, accessToken };
}

/** Google `sub` values are numeric strings (21st century, ~21 digits). */
const GOOGLE_ID_PATTERN = /^[0-9A-Za-z_-]{1,64}$/;

export interface GoogleIdentity {
  sub: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export async function fetchGoogleIdentity(
  config: GoogleOAuthConfig,
  accessToken: string
): Promise<{ identity: GoogleIdentity | null; error?: string }> {
  const res = await fetch(config.userinfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "midman-bd-google-oauth/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!res) return { identity: null, error: "userinfo_network_error" };
  if (!res.ok) return { identity: null, error: `userinfo_http_${res.status}` };

  try {
    const json = (await res.json()) as Record<string, unknown>;
    const sub = typeof json.sub === "string" ? json.sub : null;
    const email =
      typeof json.email === "string" ? json.email.trim().toLowerCase() : "";
    if (!sub || !GOOGLE_ID_PATTERN.test(sub)) {
      return { identity: null, error: "userinfo_no_usable_sub" };
    }
    if (!email || !email.includes("@")) {
      return { identity: null, error: "userinfo_email_missing" };
    }
    return {
      identity: {
        sub,
        email,
        name:
          typeof json.name === "string" && json.name.trim()
            ? json.name.trim()
            : "",
        avatarUrl:
          typeof json.picture === "string" && json.picture.startsWith("https://")
            ? json.picture
            : null,
      },
    };
  } catch {
    return { identity: null, error: "userinfo_parse_error" };
  }
}
