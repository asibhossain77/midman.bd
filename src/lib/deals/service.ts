/**
 * Midman.bd — Deal service (server-side mutations).
 *
 * EVERY deal mutation goes through this module:
 *  - identity is re-derived server-side (callers pass the verified actor)
 *  - the transition is validated against src/lib/deals/status.ts
 *  - the deal row, event timeline, money ledger and notifications are
 *    written consistently (single connection, sequential writes)
 *  - errors are typed codes the UI maps through the dictionary
 *
 * The client NEVER supplies amounts, statuses or user ids for a
 * transition — only the deal id, its own identity and dialog inputs
 * (reference, notes) are accepted, and every claim is checked here.
 */

import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { getDb } from "@/lib/turso/client";
import {
  deals,
  dealEvents,
  disputes,
  paymentMethods,
  transactions,
  users,
} from "@/lib/turso/schema";
import { recordAudit } from "@/lib/audit";
import { notifyParties } from "@/lib/notifications";
import { computeFee, getPlatformSettings } from "@/lib/settings";
import {
  canAccept,
  canCancel,
  canConfirm,
  canDeliver,
  canOpenDispute,
  canRequestRefund,
  canSubmitPayment,
  generateDealCode,
  isPayoutEligible,
  roleOf,
  type DealRole,
  type DealStatus,
} from "./status";

export type ServiceError =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_state"
  | "self_deal"
  | "invalid_amount"
  | "counterparty_not_found"
  | "email_unverified"
  | "duplicate_payment"
  | "invalid_input"
  | "db_error";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ServiceError; message?: string };

/* ------------------------------------------------------------------ */
/* Event + ledger helpers                                              */
/* ------------------------------------------------------------------ */

function recordEvent(input: {
  dealId: string;
  actorId: string | null;
  type: string;
  detail?: string | null;
}) {
  const db = getDb();
  return db.insert(dealEvents).values({
    dealId: input.dealId,
    actorId: input.actorId,
    type: input.type,
    detail: input.detail ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export interface CreateDealInput {
  actorId: string;
  actorEmailVerified: boolean;
  title: string;
  description?: string | null;
  terms?: string | null;
  amount: number;
  counterpartyEmail: string;
  createdByRole: DealRole;
  idempotencyKey?: string | null;
}

export async function createDeal(
  input: CreateDealInput
): Promise<ServiceResult<{ dealId: string; code: string }>> {
  const settings = await getPlatformSettings();

  if (settings.requireVerifiedEmailForDeals && !input.actorEmailVerified) {
    return { ok: false, code: "email_unverified" };
  }

  if (
    !Number.isInteger(input.amount) ||
    input.amount < settings.minDealAmount ||
    input.amount > settings.maxDealAmount
  ) {
    return { ok: false, code: "invalid_amount" };
  }

  const title = input.title.trim();
  if (title.length < 3 || title.length > 120) {
    return { ok: false, code: "invalid_input" };
  }

  const db = getDb();
  const counterpartyEmail = input.counterpartyEmail.trim().toLowerCase();
  const counterparty = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, counterpartyEmail))
    .limit(1);

  if (!counterparty[0]) {
    return { ok: false, code: "counterparty_not_found" };
  }
  if (counterparty[0].id === input.actorId) {
    return { ok: false, code: "self_deal" };
  }

  const buyerId =
    input.createdByRole === "buyer" ? input.actorId : counterparty[0].id;
  const sellerId =
    input.createdByRole === "seller" ? input.actorId : counterparty[0].id;

  // Unique human-friendly code (retry on the astronomically rare clash).
  let code = generateDealCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await db
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.code, code))
      .limit(1);
    if (!clash[0]) break;
    code = generateDealCode();
  }

  const feeAmount = computeFee(input.amount, settings.feePercent);

  try {
    const inserted = await db
      .insert(deals)
      .values({
        code,
        title,
        description: input.description?.trim() || null,
        terms: input.terms?.trim() || null,
        amount: input.amount,
        feeAmount,
        buyerId,
        sellerId,
        createdByRole: input.createdByRole,
        status: "pending_acceptance",
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .returning({ id: deals.id, code: deals.code });

    const deal = inserted[0];

    await recordEvent({
      dealId: deal.id,
      actorId: input.actorId,
      type: "created",
    });

    await notifyParties({
      buyerId,
      sellerId,
      actorId: input.actorId,
      type: "deal_created",
      params: { title, amount: input.amount },
      dealId: deal.id,
    });

    return { ok: true, data: { dealId: deal.id, code: deal.code } };
  } catch (error) {
    if (
      input.idempotencyKey &&
      error instanceof Error &&
      /UNIQUE constraint failed/i.test(error.message)
    ) {
      // Idempotent replay of the same creation request.
      const existing = await db
        .select({ id: deals.id, code: deals.code })
        .from(deals)
        .where(eq(deals.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing[0]) {
        return {
          ok: true,
          data: { dealId: existing[0].id, code: existing[0].code },
        };
      }
    }
    console.error("[deals] create failed:", error);
    return { ok: false, code: "db_error" };
  }
}

/* ------------------------------------------------------------------ */
/* Accept / cancel                                                     */
/* ------------------------------------------------------------------ */

export async function acceptDeal(
  dealId: string,
  actorId: string,
  note?: string
): Promise<ServiceResult<{ status: DealStatus }>> {
  const db = getDb();
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (!canAccept(deal, actorId)) return { ok: false, code: "invalid_state" };

  await db
    .update(deals)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(deals.id, dealId));
  await recordEvent({ dealId, actorId, type: "accepted", detail: note?.trim() || null });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId,
    type: "deal_accepted",
    params: { title: deal.title },
    dealId,
  });
  return { ok: true, data: { status: "accepted" } };
}

export async function cancelDeal(
  dealId: string,
  actorId: string,
  note?: string
): Promise<ServiceResult<{ status: DealStatus }>> {
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (!canCancel(deal, actorId)) return { ok: false, code: "invalid_state" };

  const db = getDb();
  await db
    .update(deals)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(deals.id, dealId));
  await recordEvent({ dealId, actorId, type: "cancelled", detail: note?.trim() || null });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId,
    type: "deal_cancelled",
    params: { title: deal.title },
    dealId,
  });
  return { ok: true, data: { status: "cancelled" } };
}

/* ------------------------------------------------------------------ */
/* Payment submission (buyer) + admin verification                     */
/* ------------------------------------------------------------------ */

export interface SubmitPaymentInput {
  methodId: string;
  reference: string;
  sender?: string | null;
  proofKey?: string | null;
  idempotencyKey?: string | null;
}

export async function submitPayment(
  dealId: string,
  actorId: string,
  input: SubmitPaymentInput
): Promise<ServiceResult<{ status: DealStatus; duplicate: boolean }>> {
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };

  // Idempotent replay FIRST: a retried submission (double-click, flaky
  // network) must succeed without recording money twice — even though
  // the deal has already moved past "accepted".
  if (input.idempotencyKey) {
    const existing = await getDb()
      .select({ id: transactions.id, dealId: transactions.dealId })
      .from(transactions)
      .where(eq(transactions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing[0]) {
      if (existing[0].dealId === dealId && deal.buyerId === actorId) {
        return { ok: true, data: { status: "payment_submitted", duplicate: true } };
      }
      return { ok: false, code: "duplicate_payment" };
    }
  }

  if (!canSubmitPayment(deal, actorId)) return { ok: false, code: "invalid_state" };

  const reference = input.reference.trim();
  if (reference.length < 3 || reference.length > 120) {
    return { ok: false, code: "invalid_input" };
  }

  const db = getDb();
  const method = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, input.methodId), eq(paymentMethods.isActive, true)))
    .limit(1);
  if (!method[0]) return { ok: false, code: "invalid_input" };

  try {
    const tx = await db
      .insert(transactions)
      .values({
        dealId,
        direction: "payment_in",
        amount: deal.amount,
        methodId: method[0].id,
        methodName: method[0].name,
        reference,
        sender: input.sender?.trim() || null,
        proofKey: input.proofKey ?? null,
        status: "submitted",
        submittedBy: actorId,
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .returning({ id: transactions.id });

    await db
      .update(deals)
      .set({
        status: "payment_submitted",
        paymentMethodId: method[0].id,
        paymentReference: reference,
        paymentSender: input.sender?.trim() || null,
        paymentProofKey: input.proofKey ?? null,
        paymentSubmittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deals.id, dealId));

    await recordEvent({
      dealId,
      actorId,
      type: "payment_submitted",
      detail: `${method[0].name} · ${reference}`,
    });

    await notifyParties({
      buyerId: deal.buyerId,
      sellerId: deal.sellerId,
      actorId,
      type: "payment_submitted",
      params: { title: deal.title, amount: deal.amount },
      dealId,
    });

    return { ok: true, data: { status: "payment_submitted", duplicate: false } };
  } catch (error) {
    // Race safety net: two concurrent submissions with the same key —
    // the unique index lets exactly one through.
    if (
      input.idempotencyKey &&
      error instanceof Error &&
      /UNIQUE constraint failed/i.test(error.message)
    ) {
      return { ok: true, data: { status: "payment_submitted", duplicate: true } };
    }
    console.error("[deals] payment submit failed:", error);
    return { ok: false, code: "db_error" };
  }
}

/** Admin: verify the buyer's payment → funds secured. */
export async function verifyPayment(
  dealId: string,
  adminId: string
): Promise<ServiceResult<{ status: DealStatus }>> {
  const db = getDb();
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (deal.status !== "payment_submitted") {
    return { ok: false, code: "invalid_state" };
  }

  const now = new Date();
  await db
    .update(deals)
    .set({
      status: "secured",
      paymentVerifiedAt: now,
      paymentVerifiedBy: adminId,
      securedAt: now,
      updatedAt: now,
    })
    .where(eq(deals.id, dealId));

  // Mark the newest submitted payment_in transaction as verified.
  const latest = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.dealId, dealId), eq(transactions.direction, "payment_in")))
    .orderBy(sql`created_at desc`)
    .limit(1);
  if (latest[0]) {
    await db
      .update(transactions)
      .set({ status: "verified", handledBy: adminId, handledAt: now, updatedAt: now })
      .where(eq(transactions.id, latest[0].id));
  }

  await recordEvent({ dealId, actorId: adminId, type: "payment_verified" });
  await recordAudit({
    actorId: adminId,
    action: "payment.verify",
    targetType: "deal",
    targetId: dealId,
    meta: { amount: deal.amount, code: deal.code },
  });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId: adminId,
    type: "payment_verified",
    params: { title: deal.title, amount: deal.amount },
    dealId,
  });
  return { ok: true, data: { status: "secured" } };
}

/** Admin: reject the payment record → buyer submits a corrected one. */
export async function rejectPayment(
  dealId: string,
  adminId: string,
  note?: string
): Promise<ServiceResult<{ status: DealStatus }>> {
  const db = getDb();
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (deal.status !== "payment_submitted") {
    return { ok: false, code: "invalid_state" };
  }

  await db
    .update(deals)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(deals.id, dealId));

  const latest = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.dealId, dealId), eq(transactions.direction, "payment_in")))
    .orderBy(sql`created_at desc`)
    .limit(1);
  if (latest[0]) {
    await db
      .update(transactions)
      .set({ status: "rejected", handledBy: adminId, handledAt: new Date(), updatedAt: new Date() })
      .where(eq(transactions.id, latest[0].id));
  }

  await recordEvent({
    dealId,
    actorId: adminId,
    type: "payment_rejected",
    detail: note?.trim() || null,
  });
  await recordAudit({
    actorId: adminId,
    action: "payment.reject",
    targetType: "deal",
    targetId: dealId,
    meta: { code: deal.code, note: note?.trim() || null },
  });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId: adminId,
    type: "payment_rejected",
    params: { title: deal.title },
    dealId,
  });
  return { ok: true, data: { status: "accepted" } };
}

/* ------------------------------------------------------------------ */
/* Delivery + confirmation                                             */
/* ------------------------------------------------------------------ */

export async function deliverDeal(
  dealId: string,
  actorId: string,
  note?: string
): Promise<ServiceResult<{ status: DealStatus }>> {
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (!canDeliver(deal, actorId)) return { ok: false, code: "invalid_state" };

  const db = getDb();
  await db
    .update(deals)
    .set({
      status: "delivered",
      deliveryNote: note?.trim() || null,
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(deals.id, dealId));
  await recordEvent({ dealId, actorId, type: "delivered", detail: note?.trim() || null });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId,
    type: "delivered",
    params: { title: deal.title },
    dealId,
  });
  return { ok: true, data: { status: "delivered" } };
}

export async function confirmDeal(
  dealId: string,
  actorId: string,
  note?: string
): Promise<ServiceResult<{ status: DealStatus; payoutStatus: string }>> {
  const db = getDb();
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (!canConfirm(deal, actorId)) return { ok: false, code: "invalid_state" };

  const now = new Date();
  await db
    .update(deals)
    .set({ status: "completed", completedAt: now, payoutStatus: "pending", updatedAt: now })
    .where(eq(deals.id, dealId));

  // Ledger: the pending payout the admin will release.
  const payoutAmount = Math.max(0, deal.amount - deal.feeAmount);
  await db
    .insert(transactions)
    .values({
      dealId,
      direction: "payout_out",
      amount: payoutAmount,
      status: "pending",
      idempotencyKey: `deal:${dealId}:payout`,
    })
    .onConflictDoNothing();

  await recordEvent({ dealId, actorId, type: "completed", detail: note?.trim() || null });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId,
    type: "completed",
    params: { title: deal.title, amount: payoutAmount },
    dealId,
  });
  return { ok: true, data: { status: "completed", payoutStatus: "pending" } };
}

/* ------------------------------------------------------------------ */
/* Disputes                                                            */
/* ------------------------------------------------------------------ */

export async function openDispute(
  dealId: string,
  actorId: string,
  reason: string
): Promise<ServiceResult<{ disputeId: string }>> {
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (!canOpenDispute(deal, actorId)) return { ok: false, code: "invalid_state" };

  const trimmed = reason.trim();
  if (trimmed.length < 10 || trimmed.length > 2000) {
    return { ok: false, code: "invalid_input" };
  }

  const db = getDb();
  const inserted = await db
    .insert(disputes)
    .values({ dealId, openedBy: actorId, reason: trimmed, status: "open" })
    .returning({ id: disputes.id });

  await db
    .update(deals)
    .set({
      status: "disputed",
      // Remember where to resume when the dispute ends in "resume".
      preDisputeStatus: deal.status,
      updatedAt: new Date(),
    })
    .where(eq(deals.id, dealId));

  await recordEvent({
    dealId,
    actorId,
    type: "dispute_opened",
    detail: trimmed,
  });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId,
    type: "dispute_opened",
    params: { title: deal.title },
    dealId,
  });
  return { ok: true, data: { disputeId: inserted[0].id } };
}

export type DisputeResolution = "refund_to_buyer" | "complete" | "resume";

export async function resolveDispute(
  disputeId: string,
  adminId: string,
  resolution: DisputeResolution,
  note?: string
): Promise<ServiceResult<{ status: DealStatus }>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(disputes)
    .where(eq(disputes.id, disputeId))
    .limit(1);
  const dispute = rows[0];
  if (!dispute) return { ok: false, code: "not_found" };
  if (dispute.status !== "open") return { ok: false, code: "invalid_state" };

  const deal = await loadDeal(dispute.dealId);
  if (!deal) return { ok: false, code: "not_found" };

  const now = new Date();
  let nextStatus: DealStatus;

  switch (resolution) {
    case "refund_to_buyer":
      nextStatus = "refund_requested";
      break;
    case "complete":
      nextStatus = "completed";
      break;
    case "resume":
      nextStatus = (deal.preDisputeStatus as DealStatus | null) ?? "secured";
      break;
  }

  await db
    .update(disputes)
    .set({
      status: "resolved",
      resolution,
      resolutionNote: note?.trim() || null,
      resolvedBy: adminId,
      resolvedAt: now,
    })
    .where(eq(disputes.id, disputeId));

  await db
    .update(deals)
    .set({
      status: nextStatus,
      preDisputeStatus: null,
      // "complete" resolution makes the payout eligible immediately.
      ...(nextStatus === "completed" && deal.payoutStatus === "none"
        ? { payoutStatus: "pending" }
        : {}),
      updatedAt: now,
    })
    .where(eq(deals.id, deal.id));

  if (nextStatus === "completed") {
    const payoutAmount = Math.max(0, deal.amount - deal.feeAmount);
    await db
      .insert(transactions)
      .values({
        dealId: deal.id,
        direction: "payout_out",
        amount: payoutAmount,
        status: "pending",
        idempotencyKey: `deal:${deal.id}:payout`,
      })
      .onConflictDoNothing();
  }

  await recordEvent({
    dealId: deal.id,
    actorId: adminId,
    type: "dispute_resolved",
    detail: `${resolution}${note?.trim() ? ` — ${note.trim()}` : ""}`,
  });
  await recordAudit({
    actorId: adminId,
    action: "dispute.resolve",
    targetType: "dispute",
    targetId: disputeId,
    meta: { resolution, dealId: deal.id, code: deal.code },
  });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId: adminId,
    type: "dispute_resolved",
    params: { title: deal.title },
    dealId: deal.id,
  });
  return { ok: true, data: { status: nextStatus } };
}

/* ------------------------------------------------------------------ */
/* Refunds (admin processes)                                           */
/* ------------------------------------------------------------------ */

export async function requestRefund(
  dealId: string,
  actorId: string,
  reason: string
): Promise<ServiceResult<{ status: DealStatus }>> {
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (!canRequestRefund(deal, actorId)) return { ok: false, code: "invalid_state" };

  const db = getDb();
  await db
    .update(deals)
    .set({ status: "refund_requested", updatedAt: new Date() })
    .where(eq(deals.id, dealId));

  // Ledger: pending refund the admin will process (idempotent per deal).
  await db
    .insert(transactions)
    .values({
      dealId,
      direction: "refund_out",
      amount: deal.amount,
      status: "pending",
      idempotencyKey: `deal:${dealId}:refund`,
    })
    .onConflictDoNothing();

  await recordEvent({
    dealId,
    actorId,
    type: "refund_requested",
    detail: reason.trim() || null,
  });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId,
    type: "refund_requested",
    params: { title: deal.title, amount: deal.amount },
    dealId,
  });
  return { ok: true, data: { status: "refund_requested" } };
}

export async function processRefund(
  dealId: string,
  adminId: string,
  reference?: string
): Promise<ServiceResult<{ status: DealStatus }>> {
  const db = getDb();
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (deal.status !== "refund_requested") return { ok: false, code: "invalid_state" };

  const now = new Date();
  await db
    .update(deals)
    .set({ status: "refunded", payoutStatus: "none", updatedAt: now })
    .where(eq(deals.id, dealId));

  await db
    .update(transactions)
    .set({
      status: "processed",
      reference: reference?.trim() || null,
      handledBy: adminId,
      handledAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(transactions.dealId, dealId),
        eq(transactions.direction, "refund_out"),
        eq(transactions.status, "pending")
      )
    );

  await recordEvent({ dealId, actorId: adminId, type: "refunded" });
  await recordAudit({
    actorId: adminId,
    action: "refund.process",
    targetType: "deal",
    targetId: dealId,
    meta: { amount: deal.amount, code: deal.code },
  });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId: adminId,
    type: "refunded",
    params: { title: deal.title, amount: deal.amount },
    dealId,
  });
  return { ok: true, data: { status: "refunded" } };
}

/* ------------------------------------------------------------------ */
/* Payout (admin releases)                                             */
/* ------------------------------------------------------------------ */

export async function markPayoutPaid(
  dealId: string,
  adminId: string,
  reference?: string
): Promise<ServiceResult<{ payoutStatus: string }>> {
  const db = getDb();
  const deal = await loadDeal(dealId);
  if (!deal) return { ok: false, code: "not_found" };
  if (!isPayoutEligible({ ...deal, hasPaymentRecord: true })) {
    return { ok: false, code: "invalid_state" };
  }

  const now = new Date();
  await db
    .update(deals)
    .set({ payoutStatus: "paid", payoutAt: now, payoutReference: reference?.trim() || null, updatedAt: now })
    .where(eq(deals.id, dealId));

  await db
    .update(transactions)
    .set({
      status: "processed",
      reference: reference?.trim() || null,
      handledBy: adminId,
      handledAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(transactions.dealId, dealId),
        eq(transactions.direction, "payout_out"),
        eq(transactions.status, "pending")
      )
    );

  await recordEvent({ dealId, actorId: adminId, type: "payout_paid" });
  await recordAudit({
    actorId: adminId,
    action: "payout.release",
    targetType: "deal",
    targetId: dealId,
    meta: { amount: deal.amount - deal.feeAmount, code: deal.code },
  });
  await notifyParties({
    buyerId: deal.buyerId,
    sellerId: deal.sellerId,
    actorId: adminId,
    type: "payout_paid",
    params: { title: deal.title, amount: deal.amount - deal.feeAmount },
    dealId,
  });
  return { ok: true, data: { payoutStatus: "paid" } };
}

/* ------------------------------------------------------------------ */
/* Internal loader                                                     */
/* ------------------------------------------------------------------ */

async function loadDeal(dealId: string) {
  const db = getDb();
  const rows = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    status: row.status as DealStatus,
    createdByRole: row.createdByRole as DealRole,
    payoutStatus: row.payoutStatus as "none" | "pending" | "paid",
  };
}
