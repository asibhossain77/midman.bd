/**
 * Same-origin guard for credential POST endpoints.
 *
 * Browsers attach an Origin header to every fetch POST; cross-site
 * posts therefore fail here BEFORE any cookie is issued. Non-browser
 * clients (curl, tests) omit Origin and pass — the session cookie
 * itself is SameSite=Lax, which blocks cross-site cookie sending.
 */

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
