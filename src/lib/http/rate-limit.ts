/**
 * In-memory sliding-window rate limiter for sensitive endpoints.
 *
 * Deliberately dependency-free: a fixed-size Map of buckets keyed by
 * scope + identifier, pruned lazily. On a single Node/Bun process this
 * is exact; on serverless every instance keeps its own window — still a
 * meaningful flood guard, and the honest boundary is documented here.
 * Upgrading to Upstash Redis later only touches this file.
 */

const BUCKETS = new Map<string, number[]>();

/** Hard bucket cap — protects memory from key-flood attacks. */
const MAX_BUCKETS = 10_000;

function prune(now: number): void {
  if (BUCKETS.size <= MAX_BUCKETS) return;
  for (const [key, hits] of BUCKETS) {
    if (hits.length === 0 || hits[hits.length - 1] < now - 3_600_000) {
      BUCKETS.delete(key);
    }
    if (BUCKETS.size <= MAX_BUCKETS) break;
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry (only when !ok). */
  retryAfterSeconds: number;
  remaining: number;
}

/**
 * Consume one hit. `identifier` must already be a low-cardinality value
 * (user id, hashed IP) — never raw attacker-controlled input.
 */
export function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now);
  const key = `${scope}:${identifier}`;
  const windowStart = now - windowMs;

  const hits = (BUCKETS.get(key) ?? []).filter((t) => t > windowStart);
  if (hits.length >= limit) {
    const retryAfterMs = hits[0] + windowMs - now;
    BUCKETS.set(key, hits);
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      remaining: 0,
    };
  }
  hits.push(now);
  BUCKETS.set(key, hits);
  return { ok: true, retryAfterSeconds: 0, remaining: limit - hits.length };
}

/**
 * Give back the most recent hit. Endpoints consume a token BEFORE
 * validation so floods are throttled even with invalid bodies; when the
 * handler then rejects for a client-fixable reason, refunding keeps the
 * budget meaningful. Abuse responses (401/403/429) are never refunded.
 */
export function refundRateLimit(scope: string, identifier: string): void {
  const key = `${scope}:${identifier}`;
  const hits = BUCKETS.get(key);
  if (hits && hits.length > 0) {
    hits.pop();
    BUCKETS.set(key, hits);
  }
}

/** Best-effort client IP for rate limiting (proxy-aware, never trusted). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return (
    request.headers.get("x-real-ip")?.slice(0, 64) ??
    request.headers.get("cf-connecting-ip")?.slice(0, 64) ??
    "unknown"
  );
}

/* ------------------------------------------------------------------ */
/* Concrete limits                                                     */
/* ------------------------------------------------------------------ */

/** Login/register/reset: 10 per IP per 10 min. */
export const AUTH_LIMITS = {
  perIp: { limit: 10, windowMs: 10 * 60 * 1000 },
} as const;

/** Deal creation: 10 per user per hour, 30 per IP per hour. */
export const DEAL_CREATE_LIMITS = {
  perUser: { limit: 10, windowMs: 60 * 60 * 1000 },
  perIp: { limit: 30, windowMs: 60 * 60 * 1000 },
} as const;

/** Payment submissions: 10 per user per 10 min, 60 per IP per hour. */
export const PAYMENT_SUBMIT_LIMITS = {
  perUser: { limit: 10, windowMs: 10 * 60 * 1000 },
  perIp: { limit: 60, windowMs: 60 * 60 * 1000 },
} as const;

/** Proof uploads: 20 per user per hour. */
export const UPLOAD_LIMITS = {
  perUser: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const;
