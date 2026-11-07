import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/auth/admin";
import { getPlatformSettings, savePlatformSettings } from "@/lib/settings";
import { recordAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/http/same-origin";

export const dynamic = "force-dynamic";

/** GET /api/admin/settings — current platform settings. */
export async function GET() {
  const auth = await requireApiAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error_key: auth.status === 401 ? "unauthorized" : "forbidden" },
      { status: auth.status }
    );
  }
  const settings = await getPlatformSettings();
  return NextResponse.json({ ok: true, settings });
}

/** POST /api/admin/settings — update platform settings (audited). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "forbidden" }, { status: 403 });
  }
  const auth = await requireApiAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error_key: auth.status === 401 ? "unauthorized" : "forbidden" },
      { status: auth.status }
    );
  }

  let body: {
    feePercent?: number;
    minDealAmount?: number;
    maxDealAmount?: number;
    requireVerifiedEmailForDeals?: boolean;
    supportEmail?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const current = await getPlatformSettings();
  const feePercent = Number(body.feePercent ?? current.feePercent);
  const minDealAmount = Number(body.minDealAmount ?? current.minDealAmount);
  const maxDealAmount = Number(body.maxDealAmount ?? current.maxDealAmount);

  if (
    !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 20 ||
    !Number.isInteger(minDealAmount) || minDealAmount < 1 ||
    !Number.isInteger(maxDealAmount) || maxDealAmount < minDealAmount
  ) {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const next = {
    feePercent,
    minDealAmount,
    maxDealAmount,
    requireVerifiedEmailForDeals: Boolean(body.requireVerifiedEmailForDeals),
    supportEmail:
      typeof body.supportEmail === "string" && body.supportEmail.includes("@")
        ? body.supportEmail.trim()
        : null,
  };

  await savePlatformSettings(next);
  await recordAudit({
    actorId: auth.identity.user.id,
    action: "settings.update",
    targetType: "settings",
    meta: { from: current, to: next },
  });
  return NextResponse.json({ ok: true, settings: next });
}
