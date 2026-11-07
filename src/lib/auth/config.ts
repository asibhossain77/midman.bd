/**
 * Midman.bd — Auth configuration.
 *
 * The escrow platform owns its session cookie (mb_session), signed with
 * its own secret. Nothing is shared with Midman Verify's session — the
 * platforms are fully independent codebases and databases.
 */

import "server-only";

import { headers } from "next/headers";

export const SESSION_COOKIE_NAME = "mb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
/** Short-lived: a pending OAuth attempt never outlives 10 minutes. */
export const GOOGLE_FLOW_COOKIE_NAME = "mb_google_flow";
export const GOOGLE_FLOW_MAX_AGE_SECONDS = 60 * 10;

/**
 * The public origin of THIS app (midman.bd in production).
 *
 * NEXT_PUBLIC_APP_URL wins when set — canonical URLs and OAuth redirect
 * URIs must be deterministic. Forwarded headers are the fallback so a
 * local dev server works without configuration.
 */
export async function getSelfOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Validate a post-login return path. Only same-site relative paths that
 * cannot be re-interpreted as another origin are allowed.
 *
 * Rejects absolute URLs, protocol-relative URLs, the backslash trick
 * and control characters. Returns the path unchanged when safe.
 */
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length > 512) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return null;
  return value;
}
