-- Midman.bd — initial escrow platform schema (idempotent).
-- Applied by scripts/apply-migrations.ts, tracked in _migrations.
-- Everything uses IF NOT EXISTS so re-running never destroys data.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  avatar_url TEXT,
  google_id TEXT,
  email_verified_at INTEGER,
  disabled_at INTEGER,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id);

CREATE TABLE IF NOT EXISTS email_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS email_tokens_hash_idx ON email_tokens (token_hash);
CREATE INDEX IF NOT EXISTS email_tokens_user_idx ON email_tokens (user_id);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account TEXT NOT NULL,
  instructions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  terms TEXT,
  amount INTEGER NOT NULL,
  fee_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  buyer_id TEXT NOT NULL REFERENCES users (id),
  seller_id TEXT NOT NULL REFERENCES users (id),
  created_by_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_acceptance',
  pre_dispute_status TEXT,
  payment_method_id TEXT REFERENCES payment_methods (id),
  payment_reference TEXT,
  payment_sender TEXT,
  payment_proof_key TEXT,
  payment_submitted_at INTEGER,
  payment_verified_at INTEGER,
  payment_verified_by TEXT REFERENCES users (id),
  secured_at INTEGER,
  delivery_note TEXT,
  delivered_at INTEGER,
  completed_at INTEGER,
  cancelled_at INTEGER,
  cancelled_by TEXT REFERENCES users (id),
  payout_status TEXT NOT NULL DEFAULT 'none',
  payout_at INTEGER,
  payout_reference TEXT,
  idempotency_key TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS deals_code_idx ON deals (code);
CREATE INDEX IF NOT EXISTS deals_buyer_idx ON deals (buyer_id);
CREATE INDEX IF NOT EXISTS deals_seller_idx ON deals (seller_id);
CREATE INDEX IF NOT EXISTS deals_status_idx ON deals (status);

CREATE TABLE IF NOT EXISTS deal_events (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals (id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users (id),
  type TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS deal_events_deal_idx ON deal_events (deal_id);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals (id),
  direction TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method_id TEXT REFERENCES payment_methods (id),
  method_name TEXT,
  reference TEXT,
  sender TEXT,
  proof_key TEXT,
  status TEXT NOT NULL,
  submitted_by TEXT REFERENCES users (id),
  handled_by TEXT REFERENCES users (id),
  handled_at INTEGER,
  idempotency_key TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_idem_idx ON transactions (idempotency_key);
CREATE INDEX IF NOT EXISTS transactions_deal_idx ON transactions (deal_id);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals (id),
  opened_by TEXT NOT NULL REFERENCES users (id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolution_note TEXT,
  resolved_by TEXT REFERENCES users (id),
  resolved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS disputes_deal_idx ON disputes (deal_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  params_json TEXT,
  deal_id TEXT REFERENCES deals (id) ON DELETE CASCADE,
  read_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users (id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  meta_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS _migrations (
  filename TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
);
