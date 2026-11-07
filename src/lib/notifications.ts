/**
 * Midman.bd — Notifications.
 *
 * Notifications store a TYPE (dictionary key) + params so the text
 * renders in the READER's language. Insert-only here; read/mark-read
 * helpers for the API layer.
 */

import "server-only";

import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";

import { getDb } from "@/lib/turso/client";
import { notifications } from "@/lib/turso/schema";

export type NotificationType =
  | "deal_created"
  | "deal_accepted"
  | "deal_cancelled"
  | "payment_submitted"
  | "payment_verified"
  | "payment_rejected"
  | "delivered"
  | "completed"
  | "dispute_opened"
  | "dispute_resolved"
  | "refund_requested"
  | "refunded"
  | "payout_paid"
  | "email_verified";

export interface NotificationParams {
  actor?: string;
  title?: string;
  amount?: number;
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  params?: NotificationParams;
  dealId?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    paramsJson: input.params ? JSON.stringify(input.params) : null,
    dealId: input.dealId ?? null,
  });
}

/** Notify BOTH parties; the actor's own copy is skipped by default. */
export async function notifyParties(input: {
  buyerId: string;
  sellerId: string;
  actorId?: string | null;
  type: NotificationType;
  params?: NotificationParams;
  dealId?: string;
}): Promise<void> {
  const targets = new Set([input.buyerId, input.sellerId]);
  if (input.actorId) targets.delete(input.actorId);
  for (const userId of targets) {
    await createNotification({
      userId,
      type: input.type,
      params: input.params,
      dealId: input.dealId,
    });
  }
}

export interface NotificationRow {
  id: string;
  type: string;
  params: NotificationParams | null;
  dealId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export async function listNotifications(
  userId: string,
  limit = 50
): Promise<NotificationRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    params: row.paramsJson ? (JSON.parse(row.paramsJson) as NotificationParams) : null,
    dealId: row.dealId,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
}

export async function countUnread(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows[0]?.count ?? 0;
}

export async function markNotificationRead(
  userId: string,
  id: string
): Promise<void> {
  const db = getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/** Housekeeping helper: prune read notifications older than 90 days. */
export async function pruneOldNotifications(): Promise<void> {
  const db = getDb();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await db
    .delete(notifications)
    .where(and(lt(notifications.createdAt, cutoff), sql`read_at is not null`));
}
