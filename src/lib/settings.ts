/**
 * Midman.bd — Platform settings (key/value with typed defaults).
 *
 * Settings live in the `settings` table as JSON. Every getter falls
 * back to a safe default so a fresh database works out of the box.
 * Changes go through the admin API and are recorded in the audit log.
 */

import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/turso/client";
import { settings } from "@/lib/turso/schema";

export interface EscrowPlatformSettings {
  /** Platform fee percent (0–20). Deducted from the seller payout. */
  feePercent: number;
  /** Min/max deal amount in whole BDT. */
  minDealAmount: number;
  maxDealAmount: number;
  /** Require a verified email before a user can CREATE deals. */
  requireVerifiedEmailForDeals: boolean;
  /** Optional support contact shown on the site footer. */
  supportEmail: string | null;
}

export const DEFAULT_SETTINGS: EscrowPlatformSettings = {
  feePercent: 2,
  minDealAmount: 100,
  maxDealAmount: 500_000,
  requireVerifiedEmailForDeals: false,
  supportEmail: null,
};

const SETTINGS_KEY = "platform";

export async function getPlatformSettings(): Promise<EscrowPlatformSettings> {
  const db = getDb();
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);
  if (!rows[0]) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(rows[0].valueJson) as Partial<EscrowPlatformSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function savePlatformSettings(
  next: EscrowPlatformSettings
): Promise<void> {
  const db = getDb();
  const valueJson = JSON.stringify(next);
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, valueJson, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { valueJson, updatedAt: new Date() },
    });
}

/** Fee in whole taka, rounded up so the platform never loses a paisa. */
export function computeFee(amount: number, feePercent: number): number {
  if (feePercent <= 0) return 0;
  return Math.ceil((amount * feePercent) / 100);
}
