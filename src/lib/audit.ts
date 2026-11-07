/**
 * Midman.bd — Audit logs.
 *
 * Every PRIVILEGED action (payment verification, dispute resolution,
 * refund processing, payout release, role changes, settings updates)
 * is recorded here, permanently. Append-only by contract.
 */

import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/turso/client";
import { auditLogs, users } from "@/lib/turso/schema";

export async function recordAudit(input: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metaJson: input.meta ? JSON.stringify(input.meta) : null,
  });
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export async function listAuditLogs(limit = 200): Promise<AuditRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      actorName: users.name,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metaJson: auditLogs.metaJson,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorName: row.actorName,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    meta: row.metaJson ? (JSON.parse(row.metaJson) as Record<string, unknown>) : null,
    createdAt: row.createdAt,
  }));
}
