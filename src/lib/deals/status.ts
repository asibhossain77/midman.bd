/**
 * Midman.bd — Deal lifecycle state machine.
 *
 * The single source of truth for which transitions are legal. EVERY
 * mutation path in the service layer validates against this module —
 * the client can never invent a state or skip a step.
 *
 * NORMAL PATH
 *   pending_acceptance → accepted → payment_submitted → secured →
 *   delivered → completed
 *
 * SIDE STATES
 *   cancelled       — by the creator (nothing paid yet) or an admin
 *   disputed        — opened by buyer or seller; FREEZES completion and
 *                     payouts until an admin resolves it
 *   refund_requested → refunded — admin processes the refund
 *
 * HARD RULES
 *   - Money only becomes "secured" after an ADMIN verifies the payment.
 *   - Payout requires: completed + payoutStatus none + no active
 *     dispute/refund. It never happens automatically.
 *   - While a dispute is open, every forward transition is refused.
 *
 * This module is dependency-free so both server code and scripts can
 * import it.
 */

export const DEAL_STATUSES = [
  "pending_acceptance",
  "accepted",
  "payment_submitted",
  "secured",
  "delivered",
  "completed",
  "disputed",
  "refund_requested",
  "refunded",
  "cancelled",
] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

export const PAYOUT_STATUSES = ["none", "pending", "paid"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export type DealRole = "buyer" | "seller";

export interface DealLike {
  status: DealStatus;
  buyerId: string;
  sellerId: string;
  payoutStatus: PayoutStatus;
  /** Whether a payment has been recorded (any submission). */
  hasPaymentRecord?: boolean;
}

/** Deal states where work is still in flight (for dashboards/filters). */
export const ACTIVE_STATUSES: readonly DealStatus[] = [
  "pending_acceptance",
  "accepted",
  "payment_submitted",
  "secured",
  "delivered",
];

/** States that freeze completion + payouts. */
export function isFrozenStatus(status: DealStatus): boolean {
  return status === "disputed" || status === "refund_requested";
}

/** Legal status → status transitions. */
const TRANSITIONS: Record<DealStatus, readonly DealStatus[]> = {
  pending_acceptance: ["accepted", "cancelled"],
  accepted: ["payment_submitted", "disputed", "refund_requested", "cancelled"],
  payment_submitted: ["secured", "accepted", "disputed", "refund_requested"],
  secured: ["delivered", "disputed", "refund_requested"],
  delivered: ["completed", "disputed", "refund_requested"],
  completed: ["disputed"],
  disputed: ["accepted", "payment_submitted", "secured", "delivered", "completed", "refunded"],
  refund_requested: ["refunded", "disputed"],
  refunded: [],
  cancelled: [],
};

export function canTransition(from: DealStatus, to: DealStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The actor's role in a deal, or null when they are not a party. */
export function roleOf(
  deal: Pick<DealLike, "buyerId" | "sellerId">,
  userId: string
): DealRole | null {
  if (deal.buyerId === userId) return "buyer";
  if (deal.sellerId === userId) return "seller";
  return null;
}

/* ------------------------------------------------------------------ */
/* Action permissions                                                  */
/* ------------------------------------------------------------------ */

export function canAccept(
  deal: DealLike & { createdByRole: DealRole },
  userId: string
): boolean {
  if (deal.status !== "pending_acceptance") return false;
  // Only the INVITED (non-creating) party accepts.
  const invitedId =
    deal.createdByRole === "buyer" ? deal.sellerId : deal.buyerId;
  return userId === invitedId;
}

export function canCancel(deal: DealLike, userId: string): boolean {
  if (deal.status !== "pending_acceptance" && deal.status !== "accepted") {
    return false;
  }
  return roleOf(deal, userId) !== null;
}

export function canSubmitPayment(
  deal: DealLike,
  userId: string
): boolean {
  return deal.status === "accepted" && deal.buyerId === userId;
}

export function canDeliver(deal: DealLike, userId: string): boolean {
  return deal.status === "secured" && deal.sellerId === userId;
}

export function canConfirm(deal: DealLike, userId: string): boolean {
  return deal.status === "delivered" && deal.buyerId === userId;
}

/** Either party can open a dispute in any live, money-bearing state. */
export function canOpenDispute(deal: DealLike, userId: string): boolean {
  if (!roleOf(deal, userId)) return false;
  return (
    deal.status === "accepted" ||
    deal.status === "payment_submitted" ||
    deal.status === "secured" ||
    deal.status === "delivered" ||
    deal.status === "completed"
  );
}

/** Either party can request a refund while money may still move back. */
export function canRequestRefund(deal: DealLike, userId: string): boolean {
  if (!roleOf(deal, userId)) return false;
  return (
    deal.status === "accepted" ||
    deal.status === "payment_submitted" ||
    deal.status === "secured" ||
    deal.status === "delivered"
  );
}

/**
 * Admin payout eligibility: completed, no active dispute/refund, and
 * the payout latch is still "none". NEVER automatic.
 */
export function isPayoutEligible(deal: DealLike): boolean {
  return (
    deal.status === "completed" &&
    // "pending" is the latch confirmDeal sets — it flips to "paid" on
    // release and "none" if the deal is ever refunded.
    deal.payoutStatus === "pending" &&
    !isFrozenStatus(deal.status)
  );
}

/* ------------------------------------------------------------------ */
/* Code generation                                                     */
/* ------------------------------------------------------------------ */

/** Human-friendly deal code, e.g. "MB-7F3K2A" (base32-ish, unambiguous). */
export function generateDealCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `MB-${code}`;
}

/** Which party must ACT next, per status (for "awaiting your action"). */
export function nextActor(
  deal: DealLike & { createdByRole: DealRole }
): "buyer" | "seller" | "admin" | "none" {
  switch (deal.status) {
    case "pending_acceptance":
      return deal.createdByRole === "buyer" ? "seller" : "buyer";
    case "accepted":
      return "buyer";
    case "payment_submitted":
      return "admin";
    case "secured":
      return "seller";
    case "delivered":
      return "buyer";
    case "refund_requested":
      return "admin";
    default:
      return "none";
  }
}
