import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireApiUser } from "@/lib/auth/admin";
import { getDb } from "@/lib/turso/client";
import { deals } from "@/lib/turso/schema";
import { getDealForUser } from "@/lib/deals/queries";
import { getStorage } from "@/lib/storage";
import { isAdminRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * GET /api/media/payment-proof/[dealId] — stream the deal's payment
 * proof to its PARTIES or an admin, nobody else. The bytes never leave
 * the storage driver without this authorization check.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: auth.status });
  }

  const { id } = await params;
  const isAdmin = isAdminRole(auth.identity.role);

  let proofKey: string | null | undefined;
  if (isAdmin) {
    const row = await getDb()
      .select({ proofKey: deals.paymentProofKey })
      .from(deals)
      .where(eq(deals.id, id))
      .limit(1);
    proofKey = row[0]?.proofKey;
  } else {
    const deal = await getDealForUser(id, auth.identity.user.id);
    proofKey = deal?.paymentProofKey;
  }

  if (!proofKey) {
    return NextResponse.json({ ok: false, error_key: "not_found" }, { status: 404 });
  }

  const stored = await getStorage().get(proofKey);
  if (!stored) {
    return NextResponse.json({ ok: false, error_key: "not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(stored.body), {
    headers: {
      "Content-Type": stored.contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
