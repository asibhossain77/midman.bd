/**
 * Midman.bd — Session module.
 *
 * The session is a signed, HttpOnly cookie that stores ONLY the
 * identity fields of the signed-in account:
 *
 *   { uid, name, email, role, avatar, iat, exp }
 *
 * It contains NO passwords, NO tokens. The signature is HMAC-SHA256
 * with SESSION_SECRET, so a cookie cannot be forged or tampered with.
 * Display fields inside the cookie are a convenience snapshot only —
 * privileged server code re-reads the users row when money is involved,
 * so a DB role change takes precedence on the very next request.
 */

import "server-only";

import crypto from "node:crypto";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./config";

export { SESSION_COOKIE_NAME };
import { toUserRole, type UserRole } from "./roles";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
}

interface SessionPayload {
  uid: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;

  // Production builds REQUIRE a strong random secret (openssl rand -base64 32).
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be set to a strong random value " +
          "(32+ characters) in production. Generate one with: openssl rand -base64 32"
      );
    }
    return secret;
  }

  if (secret && secret.length >= 16) return secret;

  // Deterministic dev/sandbox fallback — sessions simply don't survive
  // secret changes. Never reachable in production builds.
  return "midman-bd-dev-secret-change-me";
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatarUrl,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const body = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;

    if (!payload.uid || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.uid,
      name: payload.name,
      email: payload.email,
      role: toUserRole(payload.role),
      avatarUrl: payload.avatar ?? null,
    };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: SESSION_COOKIE_NAME,
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/**
 * Mint the signed session cookie on a NextResponse. `secure` follows
 * the origin (https in production, http on localhost).
 */
export function setSessionCookie(
  response: import("next/server").NextResponse,
  user: SessionUser,
  origin: string
): void {
  const secure = origin.startsWith("https://");
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(
  response: import("next/server").NextResponse
): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolve the signed-in user server-side from cookies(). Returns null
 * for anonymous visitors. Callers that act on money MUST still re-read
 * the users/deals rows — the cookie only carries identity.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE_NAME)?.value);
}
