import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight edge gate for Midman.bd's authenticated areas — PRESENCE
 * CHECKS ONLY, by design. (Next.js 16 convention: `proxy.ts`; older
 * releases knew it as `middleware.ts`.)
 *
 * The cryptographic session verification and role checks live in
 * server layouts (Node runtime) where the signed `mb_session` cookie
 * is HMAC-verified. This proxy never inspects cookie VALUES. It only:
 *
 *   1. Sends visitors with NO session cookie to /login, preserving the
 *      deep link in `?next=` (re-validated by sanitizeNextPath()).
 *   2. Exposes the original path to server components via the
 *      `x-mb-pathname` header (layouts cannot read the pathname).
 */

const SESSION_COOKIE = "mb_session";

export function proxy(request: NextRequest) {
  const pathWithQuery = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("next", pathWithQuery);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mb-pathname", pathWithQuery);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Static matcher (Next.js requires statically parseable config):
// the authenticated areas — dashboard, deals, notifications,
// activity, settings and admin.
export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/deals",
    "/deals/:path*",
    "/notifications",
    "/notifications/:path*",
    "/activity",
    "/activity/:path*",
    "/settings",
    "/settings/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
