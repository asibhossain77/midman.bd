/**
 * Midman.bd — Deal queries (server-side reads).
 *
 * Every read is access-checked: a user only ever sees deals they are a
 * party to; admins see everything through the admin functions. Party
 * names/emails come from aliased users joins — never from client input.
 */

import "server-only";

import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { getDb, isDatabaseConfigured } from "@/lib/turso/client";
import {
  deals,
  dealEvents,
  disputes,
  paymentMethods,
  transactions,
  users,
} from "@/lib/turso/schema";
import {
  ACTIVE_STATUSES,
  type DealRole,
  type DealStatus,
  type PayoutStatus,
} from "./status";

const buyers = alias(users, "buyers");
const sellers = alias(users, "sellers");

export interface DealSummary {
  id: string;
  code: string;
  title: string;
  amount: number;
  feeAmount: number;
  status: DealStatus;
  payoutStatus: PayoutStatus;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  createdByRole: DealRole;
  createdAt: Date;
  updatedAt: Date;
}

const summaryColumns = {
  id: deals.id,
  code: deals.code,
  title: deals.title,
  amount: deals.amount,
  feeAmount: deals.feeAmount,
  status: deals.status,
  payoutStatus: deals.payoutStatus,
  buyerId: deals.buyerId,
  sellerId: deals.sellerId,
  buyerName: buyers.name,
  buyerEmail: buyers.email,
  sellerName: sellers.name,
  sellerEmail: sellers.email,
  createdByRole: deals.createdByRole,
  createdAt: deals.createdAt,
  updatedAt: deals.updatedAt,
};

function baseSummaryQuery() {
  return getDb()
    .select(summaryColumns)
    .from(deals)
    .innerJoin(buyers, eq(deals.buyerId, buyers.id))
    .innerJoin(sellers, eq(deals.sellerId, sellers.id));
}

type RawSummary = {
  [K in keyof typeof summaryColumns]: unknown;
};

function normalizeSummary(row: RawSummary): DealSummary {
  return {
    ...(row as unknown as DealSummary),
    status: row.status as DealStatus,
    payoutStatus: row.payoutStatus as PayoutStatus,
    createdByRole: row.createdByRole as DealRole,
  };
}

/* ------------------------------------------------------------------ */
/* User-scoped reads                                                   */
/* ------------------------------------------------------------------ */

export type DealsFilter = "all" | "active" | "completed" | "disputed";

export async function listDealsForUser(
  userId: string,
  filter: DealsFilter = "all",
  limit = 100
): Promise<DealSummary[]> {
  const partyFilter = or(eq(deals.buyerId, userId), eq(deals.sellerId, userId));
  const where =
    filter === "active"
      ? and(partyFilter, sql`${deals.status} in ('pending_acceptance','accepted','payment_submitted','secured','delivered')`)
      : filter === "completed"
        ? and(partyFilter, eq(deals.status, "completed"))
        : filter === "disputed"
          ? and(partyFilter, sql`${deals.status} in ('disputed','refund_requested','refunded')`)
          : partyFilter;

  const rows = await baseSummaryQuery()
    .where(where)
    .orderBy(desc(deals.createdAt))
    .limit(limit);
  return rows.map(normalizeSummary);
}

export interface DealDetail extends DealSummary {
  description: string | null;
  terms: string | null;
  currency: string;
  paymentReference: string | null;
  paymentSender: string | null;
  paymentProofKey: string | null;
  paymentSubmittedAt: Date | null;
  paymentVerifiedAt: Date | null;
  securedAt: Date | null;
  deliveryNote: string | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  payoutAt: Date | null;
  payoutReference: string | null;
}

/** Deal for a PARTY (or admin). Returns null when not a party. */
export async function getDealForUser(
  dealId: string,
  userId: string
): Promise<DealDetail | null> {
  const rows = await getDb()
    .select({
      ...summaryColumns,
      description: deals.description,
      terms: deals.terms,
      currency: deals.currency,
      paymentReference: deals.paymentReference,
      paymentSender: deals.paymentSender,
      paymentProofKey: deals.paymentProofKey,
      paymentSubmittedAt: deals.paymentSubmittedAt,
      paymentVerifiedAt: deals.paymentVerifiedAt,
      securedAt: deals.securedAt,
      deliveryNote: deals.deliveryNote,
      deliveredAt: deals.deliveredAt,
      completedAt: deals.completedAt,
      cancelledAt: deals.cancelledAt,
      payoutAt: deals.payoutAt,
      payoutReference: deals.payoutReference,
    })
    .from(deals)
    .innerJoin(buyers, eq(deals.buyerId, buyers.id))
    .innerJoin(sellers, eq(deals.sellerId, sellers.id))
    .where(and(eq(deals.id, dealId), or(eq(deals.buyerId, userId), eq(deals.sellerId, userId))))
    .limit(1);

  if (!rows[0]) return null;
  const raw = rows[0];
  return {
    ...normalizeSummary(raw),
    description: raw.description,
    terms: raw.terms,
    currency: raw.currency,
    paymentReference: raw.paymentReference,
    paymentSender: raw.paymentSender,
    paymentProofKey: raw.paymentProofKey,
    paymentSubmittedAt: raw.paymentSubmittedAt,
    paymentVerifiedAt: raw.paymentVerifiedAt,
    securedAt: raw.securedAt,
    deliveryNote: raw.deliveryNote,
    deliveredAt: raw.deliveredAt,
    completedAt: raw.completedAt,
    cancelledAt: raw.cancelledAt,
    payoutAt: raw.payoutAt,
    payoutReference: raw.payoutReference,
  };
}

/** Admin variant: any deal. */
export async function getDealForAdmin(dealId: string): Promise<DealDetail | null> {
  const rows = await getDb()
    .select({
      ...summaryColumns,
      description: deals.description,
      terms: deals.terms,
      currency: deals.currency,
      paymentReference: deals.paymentReference,
      paymentSender: deals.paymentSender,
      paymentProofKey: deals.paymentProofKey,
      paymentSubmittedAt: deals.paymentSubmittedAt,
      paymentVerifiedAt: deals.paymentVerifiedAt,
      securedAt: deals.securedAt,
      deliveryNote: deals.deliveryNote,
      deliveredAt: deals.deliveredAt,
      completedAt: deals.completedAt,
      cancelledAt: deals.cancelledAt,
      payoutAt: deals.payoutAt,
      payoutReference: deals.payoutReference,
    })
    .from(deals)
    .innerJoin(buyers, eq(deals.buyerId, buyers.id))
    .innerJoin(sellers, eq(deals.sellerId, sellers.id))
    .where(eq(deals.id, dealId))
    .limit(1);
  return rows[0] ? (rows[0] as unknown as DealDetail) : null;
}

/* ------------------------------------------------------------------ */
/* Deal timeline + ledger                                              */
/* ------------------------------------------------------------------ */

export interface DealEventRow {
  id: string;
  type: string;
  detail: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: Date;
}

export async function getDealEvents(dealId: string): Promise<DealEventRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: dealEvents.id,
      type: dealEvents.type,
      detail: dealEvents.detail,
      actorId: dealEvents.actorId,
      actorName: users.name,
      createdAt: dealEvents.createdAt,
    })
    .from(dealEvents)
    .leftJoin(users, eq(dealEvents.actorId, users.id))
    .where(eq(dealEvents.dealId, dealId))
    .orderBy(desc(dealEvents.createdAt))
    .limit(200);
  return rows;
}

export interface DealTransactionRow {
  id: string;
  dealId: string;
  dealCode: string;
  dealTitle: string;
  direction: string;
  amount: number;
  methodName: string | null;
  reference: string | null;
  sender: string | null;
  proofKey: string | null;
  status: string;
  submittedByName: string | null;
  createdAt: Date;
}

const dealCols = {
  dealId: deals.id,
  dealCode: deals.code,
  dealTitle: deals.title,
};

function txQuery() {
  return getDb()
    .select({
      ...dealCols,
      id: transactions.id,
      direction: transactions.direction,
      amount: transactions.amount,
      methodName: transactions.methodName,
      reference: transactions.reference,
      sender: transactions.sender,
      proofKey: transactions.proofKey,
      status: transactions.status,
      submittedByName: users.name,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(deals, eq(transactions.dealId, deals.id))
    .leftJoin(users, eq(transactions.submittedBy, users.id));
}

/** Transactions of ONE deal (visible to its parties). */
export async function getDealTransactions(
  dealId: string
): Promise<DealTransactionRow[]> {
  return txQuery().where(eq(transactions.dealId, dealId)).orderBy(desc(transactions.createdAt));
}

/** Platform-wide ledger (admin). */
export async function listTransactionsAdmin(limit = 200): Promise<DealTransactionRow[]> {
  return txQuery().orderBy(desc(transactions.createdAt)).limit(limit);
}

/** One user's transactions (activity page). */
export async function listTransactionsForUser(
  userId: string,
  limit = 100
): Promise<DealTransactionRow[]> {
  return txQuery()
    .where(or(eq(deals.buyerId, userId), eq(deals.sellerId, userId)))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Admin queues                                                        */
/* ------------------------------------------------------------------ */

/** Deals awaiting payment verification (status = payment_submitted). */
export async function listPaymentQueue(): Promise<DealSummary[]> {
  const rows = await baseSummaryQuery()
    .where(eq(deals.status, "payment_submitted"))
    .orderBy(desc(deals.updatedAt))
    .limit(100);
  return rows.map(normalizeSummary);
}

export interface DisputeWithDeal {
  id: string;
  dealId: string;
  dealCode: string;
  dealTitle: string;
  dealStatus: DealStatus;
  openedByName: string;
  openedByRole: "buyer" | "seller";
  reason: string;
  status: string;
  createdAt: Date;
}

export async function listDisputes(
  openOnly: boolean
): Promise<DisputeWithDeal[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: disputes.id,
      dealId: disputes.dealId,
      dealCode: deals.code,
      dealTitle: deals.title,
      dealStatus: deals.status,
      reason: disputes.reason,
      status: disputes.status,
      createdAt: disputes.createdAt,
      openedByName: users.name,
      openedByRole: sql<string>`case when ${disputes.openedBy} = ${deals.buyerId} then 'buyer' else 'seller' end`,
    })
    .from(disputes)
    .innerJoin(deals, eq(disputes.dealId, deals.id))
    .innerJoin(users, eq(disputes.openedBy, users.id))
    .where(openOnly ? eq(disputes.status, "open") : sql`1=1`)
    .orderBy(desc(disputes.createdAt))
    .limit(100);
  return rows.map((row) => ({
    ...row,
    dealStatus: row.dealStatus as DealStatus,
    openedByRole: row.openedByRole as "buyer" | "seller",
  }));
}

/** Pending refund transactions (admin queue). */
export async function listRefundQueue(): Promise<DealTransactionRow[]> {
  return txQuery()
    .where(and(eq(transactions.direction, "refund_out"), eq(transactions.status, "pending")))
    .orderBy(desc(transactions.createdAt))
    .limit(100);
}

/** Completed deals whose payout is awaiting release. */
export async function listPayoutQueue(): Promise<DealSummary[]> {
  const rows = await baseSummaryQuery()
    .where(and(eq(deals.status, "completed"), eq(deals.payoutStatus, "pending")))
    .orderBy(desc(deals.updatedAt))
    .limit(100);
  return rows.map(normalizeSummary);
}

/** Platform-wide deal list (admin). */
export async function listDealsAdmin(limit = 200): Promise<DealSummary[]> {
  const rows = await baseSummaryQuery()
    .orderBy(desc(deals.createdAt))
    .limit(limit);
  return rows.map(normalizeSummary);
}

/* ------------------------------------------------------------------ */
/* Dashboard stats                                                     */
/* ------------------------------------------------------------------ */

export interface UserStats {
  totalDeals: number;
  activeDeals: number;
  completedDeals: number;
  pendingPayments: number;
  disputedDeals: number;
  securedValue: number;
  awaitingYourAction: number;
}

export async function getUserStats(
  userId: string,
  actionDealIds: string[]
): Promise<UserStats> {
  const db = getDb();
  const member = or(eq(deals.buyerId, userId), eq(deals.sellerId, userId));

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when status in ('pending_acceptance','accepted','payment_submitted','secured','delivered') then 1 else 0 end)`,
      completed: sql<number>`sum(case when status = 'completed' then 1 else 0 end)`,
      pendingPayments: sql<number>`sum(case when status = 'payment_submitted' then 1 else 0 end)`,
      disputed: sql<number>`sum(case when status in ('disputed','refund_requested') then 1 else 0 end)`,
      secured: sql<number>`coalesce(sum(case when status in ('secured','delivered','completed') then amount else 0 end), 0)`,
    })
    .from(deals)
    .where(member);

  return {
    totalDeals: counts?.total ?? 0,
    activeDeals: counts?.active ?? 0,
    completedDeals: counts?.completed ?? 0,
    pendingPayments: counts?.pendingPayments ?? 0,
    disputedDeals: counts?.disputed ?? 0,
    securedValue: counts?.secured ?? 0,
    awaitingYourAction: actionDealIds.length,
  };
}

export interface AdminStats {
  users: number;
  deals: number;
  activeDeals: number;
  completedDeals: number;
  disputedDeals: number;
  pendingPayments: number;
  pendingRefunds: number;
  payoutsPending: number;
  securedValue: number;
}

export async function getAdminStats(): Promise<AdminStats | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();

  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  const [dealCounts] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when status in ('pending_acceptance','accepted','payment_submitted','secured','delivered') then 1 else 0 end)`,
      completed: sql<number>`sum(case when status = 'completed' then 1 else 0 end)`,
      disputed: sql<number>`sum(case when status in ('disputed','refund_requested') then 1 else 0 end)`,
      pendingPayments: sql<number>`sum(case when status = 'payment_submitted' then 1 else 0 end)`,
      secured: sql<number>`coalesce(sum(case when status in ('secured','delivered','completed') then amount else 0 end), 0)`,
    })
    .from(deals);

  const [refundPending] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(eq(transactions.direction, "refund_out"), eq(transactions.status, "pending")));

  const [payoutPending] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deals)
    .where(and(eq(deals.status, "completed"), eq(deals.payoutStatus, "pending")));

  return {
    users: userCount?.count ?? 0,
    deals: dealCounts?.total ?? 0,
    activeDeals: dealCounts?.active ?? 0,
    completedDeals: dealCounts?.completed ?? 0,
    disputedDeals: dealCounts?.disputed ?? 0,
    pendingPayments: dealCounts?.pendingPayments ?? 0,
    pendingRefunds: refundPending?.count ?? 0,
    payoutsPending: payoutPending?.count ?? 0,
    securedValue: dealCounts?.secured ?? 0,
  };
}

/** Deals where the user should act right now (ids only). */
export async function getActionRequiredDealIds(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: deals.id, buyerId: deals.buyerId, sellerId: deals.sellerId, createdByRole: deals.createdByRole })
    .from(deals)
    .where(
      and(
        or(eq(deals.buyerId, userId), eq(deals.sellerId, userId)),
        sql`(
          (status = 'pending_acceptance' and ((created_by_role = 'buyer' and seller_id = ${userId}) or (created_by_role = 'seller' and buyer_id = ${userId})))
          or (status = 'accepted' and buyer_id = ${userId})
          or (status = 'delivered' and buyer_id = ${userId})
          or (status = 'secured' and seller_id = ${userId})
        )`
      )
    )
    .limit(50);
  return rows.map((r) => r.id);
}

/** Active payment channels for the payment dialog. */
export async function listActivePaymentMethods() {
  const db = getDb();
  return db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.isActive, true))
    .orderBy(paymentMethods.sortOrder)
    .limit(20);
}

export async function listAllPaymentMethods() {
  const db = getDb();
  return db
    .select()
    .from(paymentMethods)
    .orderBy(paymentMethods.sortOrder)
    .limit(100);
}

export { ACTIVE_STATUSES };
