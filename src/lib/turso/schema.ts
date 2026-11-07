/**
 * Midman.bd — Turso Database Schema (Drizzle ORM / libSQL)
 *
 * ARCHITECTURE RULES
 * ------------------
 * 1. This database stores ONLY Midman.bd escrow data. It is completely
 *    separate from the Midman Verify database.
 * 2. Accounts: the platform keeps its OWN `users` table (bcrypt hashes
 *    only — never plaintext). Google sign-in links by google_id, then
 *    email — never a duplicate user.
 * 3. Money never lives here as a balance: deals + an append-only
 *    transactions ledger record what happened; admin verification is
 *    the only path that marks funds as secured.
 * 4. Deal events, transactions and audit logs are append-only by
 *    contract — the application never UPDATEs or DELETEs them.
 *
 * Keep the status/type unions in `src/lib/deals/status.ts` in sync
 * with this schema.
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

/* ------------------------------------------------------------------ */
/* Accounts (manual email + password, optional Google link)             */
/* ------------------------------------------------------------------ */

/**
 * The escrow platform's account table.
 *
 * - `password_hash` is a bcrypt hash (cost 12) — the plaintext password
 *   is never stored, logged or returned by any API.
 * - `role` ("user" | "admin", see src/lib/auth/roles.ts) is "user" for
 *   every self-registered account — the public API never accepts a
 *   role. Admins are promoted DIRECTLY in the database:
 *     bun scripts/set-user-role.ts <email> admin
 * - `google_id` links a Google identity to the matching-email row.
 * - `email_verified_at` flips when a verification token is consumed.
 */
export const users = sqliteTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** user | admin — self-registration always yields "user". */
    role: text("role").notNull().default("user"),
    avatarUrl: text("avatar_url"),
    /** Google account `sub` (openid connect) — the linking key. */
    googleId: text("google_id"),
    emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
    /** Soft disable switch for admin use — a disabled user cannot log in. */
    disabledAt: integer("disabled_at", { mode: "timestamp" }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_google_id_idx").on(t.googleId),
  ]
);

/* ------------------------------------------------------------------ */
/* Email tokens (verification + password reset)                        */
/* ------------------------------------------------------------------ */

/**
 * One-time tokens, stored as SHA-256 hashes (a DB leak can never mint
 * a working link). Two purposes:
 *   verify_email — flips users.email_verified_at
 *   password_reset — authorizes a new password (1 hour validity)
 */
export const emailTokens = sqliteTable(
  "email_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** verify_email | password_reset */
    type: text("type").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("email_tokens_hash_idx").on(t.tokenHash),
    index("email_tokens_user_idx").on(t.userId),
  ]
);

/* ------------------------------------------------------------------ */
/* Payment channels (admin-managed instructions for buyers)             */
/* ------------------------------------------------------------------ */

export const paymentMethods = sqliteTable("payment_methods", {
  id: id(),
  name: text("name").notNull(),
  /** Where the buyer sends the money, e.g. a bKash merchant number. */
  account: text("account").notNull(),
  /** Extra instructions shown in the payment dialog. */
  instructions: text("instructions"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Deals — the escrow core                                             */
/* ------------------------------------------------------------------ */

/**
 * One escrow deal between two accounts.
 *
 * AMOUNTS are integer BDT (whole taka). `fee_amount` is derived at
 * creation from the platform settings and frozen on the deal row so a
 * later fee change never mutates an existing agreement.
 *
 * STATUS — the server-enforced lifecycle (see src/lib/deals/status.ts):
 *   pending_acceptance → accepted → payment_submitted → secured →
 *   delivered → completed, with disputed / refund_requested / refunded
 *   / cancelled side-states. While `disputed` (or `refund_requested`)
 *   every completion/payout path is frozen.
 */
export const deals = sqliteTable(
  "deals",
  {
    id: id(),
    /** Human-friendly reference, e.g. "MB-7F3K2A" — unique, indexed. */
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    terms: text("terms"),
    amount: integer("amount").notNull(),
    feeAmount: integer("fee_amount").notNull().default(0),
    currency: text("currency").notNull().default("BDT"),

    buyerId: text("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** "buyer" | "seller" — which side created the deal. */
    createdByRole: text("created_by_role").notNull(),

    /** pending_acceptance | accepted | payment_submitted | secured |
     *  delivered | completed | disputed | refund_requested | refunded |
     *  cancelled */
    status: text("status").notNull().default("pending_acceptance"),
    /** Status to resume after a dispute resolves in nobody's favor. */
    preDisputeStatus: text("pre_dispute_status"),

    /** Latest buyer payment record (also duplicated into transactions). */
    paymentMethodId: text("payment_method_id").references(
      () => paymentMethods.id,
      { onDelete: "set null" }
    ),
    paymentReference: text("payment_reference"),
    paymentSender: text("payment_sender"),
    paymentProofKey: text("payment_proof_key"),
    paymentSubmittedAt: integer("payment_submitted_at", { mode: "timestamp" }),
    paymentVerifiedAt: integer("payment_verified_at", { mode: "timestamp" }),
    paymentVerifiedBy: text("payment_verified_by").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    securedAt: integer("secured_at", { mode: "timestamp" }),

    deliveryNote: text("delivery_note"),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),

    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    cancelledBy: text("cancelled_by").references(() => users.id, {
      onDelete: "set null",
    }),

    /** none | pending | paid — the seller payout latch. "pending" only
     *  ever from a completed deal with NO active dispute/refund. */
    payoutStatus: text("payout_status").notNull().default("none"),
    payoutAt: integer("payout_at", { mode: "timestamp" }),
    payoutReference: text("payout_reference"),

    /** Client-supplied idempotency key for deal creation (optional). */
    idempotencyKey: text("idempotency_key"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("deals_code_idx").on(t.code),
    index("deals_buyer_idx").on(t.buyerId),
    index("deals_seller_idx").on(t.sellerId),
    index("deals_status_idx").on(t.status),
  ]
);

/* ------------------------------------------------------------------ */
/* Deal events — append-only timeline                                  */
/* ------------------------------------------------------------------ */

export const dealEvents = sqliteTable(
  "deal_events",
  {
    id: id(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    /** Actor user id, or NULL for system/admin boilerplate entries. */
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** created | accepted | cancelled | payment_submitted | … */
    type: text("type").notNull(),
    /** Free-text detail (e.g. dispute reason) — displayed in the timeline. */
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("deal_events_deal_idx").on(t.dealId)]
);

/* ------------------------------------------------------------------ */
/* Transactions — append-only money ledger                             */
/* ------------------------------------------------------------------ */

/**
 * The platform-wide ledger of money movements:
 *   payment_in  — buyer → escrow (submitted → verified/rejected)
 *   payout_out  — escrow → seller (pending → processed)
 *   refund_out  — escrow → buyer (pending → processed)
 *
 * `idempotency_key` carries the client's key (payment submissions) or
 * a server-generated composite ("deal:<id>:payout") so a retried admin
 * action can never double-record money.
 */
export const transactions = sqliteTable(
  "transactions",
  {
    id: id(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "restrict" }),
    /** payment_in | payout_out | refund_out */
    direction: text("direction").notNull(),
    amount: integer("amount").notNull(),
    methodId: text("method_id").references(() => paymentMethods.id, {
      onDelete: "set null",
    }),
    methodName: text("method_name"),
    reference: text("reference"),
    sender: text("sender"),
    proofKey: text("proof_key"),
    /** payment_in: submitted | verified | rejected
     *  payout_out / refund_out: pending | processed */
    status: text("status").notNull(),
    submittedBy: text("submitted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Admin who verified / processed the movement. */
    handledBy: text("handled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    handledAt: integer("handled_at", { mode: "timestamp" }),
    idempotencyKey: text("idempotency_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("transactions_idem_idx").on(t.idempotencyKey),
    index("transactions_deal_idx").on(t.dealId),
    index("transactions_status_idx").on(t.status),
  ]
);

/* ------------------------------------------------------------------ */
/* Disputes                                                            */
/* ------------------------------------------------------------------ */

export const disputes = sqliteTable(
  "disputes",
  {
    id: id(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "restrict" }),
    openedBy: text("opened_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    /** open | resolved */
    status: text("status").notNull().default("open"),
    /** refund_to_buyer | release_to_seller | resume | complete */
    resolution: text("resolution"),
    resolutionNote: text("resolution_note"),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("disputes_deal_idx").on(t.dealId)]
);

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

/**
 * In-app notifications. The `type` is a dictionary key
 * (dict.notifTexts[type]) and `params` carries { actor, title, amount }
 * so the text renders in the READER's language.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    paramsJson: text("params_json"),
    dealId: text("deal_id").references(() => deals.id, {
      onDelete: "cascade",
    }),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)]
);

/* ------------------------------------------------------------------ */
/* Audit logs (privileged/admin actions)                               */
/* ------------------------------------------------------------------ */

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** e.g. "payment.verify", "dispute.resolve", "user.role_change" */
    action: text("action").notNull(),
    /** e.g. "deal", "user", "settings" */
    targetType: text("target_type"),
    targetId: text("target_id"),
    metaJson: text("meta_json"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_actor_idx").on(t.actorId)]
);

/* ------------------------------------------------------------------ */
/* Platform settings (key/value)                                       */
/* ------------------------------------------------------------------ */

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: updatedAt(),
});
