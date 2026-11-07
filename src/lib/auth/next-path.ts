/**
 * Client-safe next-path sanitizer (shared with the server's
 * lib/auth/config logic). Mirrors the exact rules so the login form can
 * re-validate `?next=` before redirecting.
 */
export function sanitizeNextPath(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  if (value.length > 512) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return null;
  return value;
}
