# Midman.bd — Bangladesh's Trusted Escrow Platform

**Midman.bd** holds the buyer's payment in secure escrow while the seller delivers. The seller is paid only after the buyer confirms delivery — nobody can walk away with the money. Disputes freeze everything until a Midman admin resolves them.

It is the escrow member of the **Midman product family** — built to be visually and experientially consistent with its sibling [Midman Verify](https://verify.midman.bd) (business & brand verification directory): the same leaf-green identity, the same typography, the same dashboard language, the same Bangla-first experience.

> Status: **initial version (escrow core only)** — Marketplace, SMM Panel, Seller Marketplace and Meta Catalog modules are intentionally out of scope for this release.

---

## Feature set (this release)

### Accounts & auth
- Email + password registration (bcrypt cost 12, timing-safe login)
- Email verification with one-time SHA-256-hashed tokens (24 h validity)
- Password reset (1 h validity) — no account enumeration
- **Continue with Google** (OAuth 2.0 + PKCE S256, create-or-link by google_id → email) — activates when configured
- Signed HttpOnly session cookie (HMAC-SHA256, 7 days); role changes apply without re-login
- Account settings: profile name, password change, verification state

### Escrow deals (the core lifecycle)
```
Create Deal → Other Party Accepts → Buyer Pays → Payment Verified (admin)
→ Payment Secured → Seller Delivers → Buyer Confirms → Deal Completed
→ Eligible Seller Payout (admin-released, never automatic)
```
- Server-enforced state machine — the client can never invent a status or skip a step
- Buyer payment submission with channel, reference, sender note and proof screenshot (R2 in production, local disk in dev; party/admin-only access)
- **Admin payment verification** is the only path that marks money as secured
- Idempotent submissions: retried payments (same idempotency key) succeed without recording money twice; duplicate new submissions are refused
- Delivery + buyer confirmation; disputes freeze completion and payouts instantly
- Refund requests → admin processing → refunded (terminal, payout blocked)
- Append-only money ledger (`transactions`) + append-only deal timeline (`deal_events`)
- In-app notifications (localized at read time) + transaction activity history

### Admin (server-side enforced, fully audited)
- Platform overview with live counts
- Payment verification queue (verify / reject with note)
- Dispute management: refund-to-buyer / complete / resume, with resolution notes
- Refund processing, payout release (idempotent per deal)
- User management (role changes, self-guard) — admins are minted via CLI, never via the API
- Platform-wide transaction history and audit logs
- Platform settings: fee %, min/max deal amount, verified-email policy, buyer payment channels

### Platform
- **Bangla-first** UI with full English (cookie-persisted switcher, `mb_lang`)
- Light/dark themes (class-based, OS-aware)
- SEO: bilingual metadata, canonical + hreflang, `sitemap.xml`, `robots.txt` (dashboards/admin/api are never indexed), Open Graph/Twitter cards
- Security headers (HSTS, nosniff, frame-deny, referrer policy), same-origin guards, per-endpoint rate limiting

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, standalone output), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons |
| Database | Turso / libSQL via `@libsql/client` + Drizzle ORM |
| Storage | Cloudflare R2 (S3-compatible) with local-disk driver fallback |
| Email | Resend REST API (console-log fallback in dev) |
| Auth | Custom signed-cookie sessions + bcrypt (no third-party auth runtime) |
| Runtime | Node ≥ 20.9 / Bun ≥ 1.1 |

All secrets stay out of source code. The platform's database is **completely independent** from Midman Verify's.

---

## Quick start (local)

```bash
# 1. install
bun install        # or: npm install / pnpm install

# 2. configure environment
cp .env.example .env.local
#   minimum for local dev: TURSO_DATABASE_URL (a file: URL works) + SESSION_SECRET

# 3. create the schema (idempotent, tracked in _migrations)
bun run db:migrate

# 4. (optional) seed the demo buyer payment channels
bun scripts/seed-payment-methods.ts

# 5. run
bun run dev        # http://localhost:3000
```

### Make yourself an admin

Admins are NEVER created through the public API. Promote directly in the database:

```bash
bun scripts/set-user-role.ts you@example.com admin
```

The change applies on the account's next request — no re-login needed.

---

## Environment variables

See [`.env.example`](.env.example) for the full annotated list.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | production | Public origin — canonical URLs + Google redirect URI |
| `TURSO_DATABASE_URL` | always | libSQL/Turso URL (`file:…` locally, `libsql://…` in production) |
| `TURSO_AUTH_TOKEN` | remote DB | Auth token for remote Turso databases |
| `SESSION_SECRET` | production | HMAC secret for session cookies — `openssl rand -base64 32`, 32+ chars |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | production | Cloudflare R2 for payment proofs (absent → local `.data/uploads` driver) |
| `R2_ENDPOINT` / `R2_FORCE_PATH_STYLE` | testing | Point the same code at an S3-compatible server |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | optional | Enables "Continue with Google" (redirect: `{APP_URL}/auth/google/callback`) |
| `GOOGLE_OAUTH_PROMPT` / `GOOGLE_OAUTH_SCOPE` / `GOOGLE_OAUTH_AUTHORIZATION_URL` / `GOOGLE_OAUTH_TOKEN_URL` / `GOOGLE_OAUTH_USERINFO_URL` | optional | Google flow overrides |
| `RESEND_API_KEY` / `EMAIL_FROM` | optional | Real email delivery; absent → emails are logged and, outside production, links surface in the UI |
| `RESEND_API_URL` | testing | Override the Resend endpoint (local catcher) |
| `NEXT_PUBLIC_VERIFY_SITE_URL` | optional | Footer link to the sibling Midman Verify product |

---

## Database setup (Turso)

1. Create a dedicated Turso database for this platform (`turso db create midman-bd`).
2. Put its URL + an auth token into `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`.
3. Apply migrations: `bun run db:migrate` (idempotent — applied files are tracked in `_migrations`).
4. Local development can use a plain file: `TURSO_DATABASE_URL=file:./db/local.db` (the `db/` folder is git-ignored).

Schema lives in [`src/lib/turso/schema.ts`](src/lib/turso/schema.ts); SQL migrations in [`scripts/migrations/`](scripts/migrations/).

---

## Testing

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run build       # production build (standalone)

# full production-bundle e2e (lifecycle, disputes, refunds, isolation, RBAC):
bun scripts/apply-migrations.ts
bun scripts/seed-payment-methods.ts
bun .next/standalone/server.js &            # PORT=3000 by default
bun scripts/e2e-test.mjs http://localhost:3000

# visual matrix (light/dark × bn/en × desktop/mobile, zero-console check):
bun scripts/visual-test.mjs http://localhost:3000
```

## Deployment notes (Vercel-compatible / standalone)

- `bun run build` produces `.next/standalone` — run `bun .next/standalone/server.js` behind any reverse proxy, or deploy on Vercel with the env vars above.
- **No DNS/deployment is configured by this repository delivery** — production go-live is a separate, deliberate step.
- Until R2 is configured, uploads use the local disk driver — fine for development, **not** for production.
- Payment verification is a human admin decision; there is no payment-processor integration in this release (documented limitation).

---

## Security model (summary)

- Identity lives in a signed HttpOnly cookie; **authorization is always re-derived from the database** (roles, deal parties) on privileged paths.
- Every deal mutation validates against the state machine in `src/lib/deals/status.ts`.
- Money can only become "secured" through admin verification; payouts require completed + unfrozen + admin release; every privileged action is appended to `audit_logs`.
- Deal events and transactions are append-only by contract.
- Rate limiting on auth, deal creation, payment submissions and uploads; same-origin checks on all POSTs.
- Payment proofs are private: served only to the deal's parties or an admin, never public URLs.

See [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) for the visual language documentation.
