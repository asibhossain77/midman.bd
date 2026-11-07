import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import { isSameOrigin } from "@/lib/http/same-origin";
import { clientIp, consumeRateLimit, UPLOAD_LIMITS } from "@/lib/http/rate-limit";
import {
  getStorage,
  newProofKey,
  validateProofFile,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/uploads/payment-proof — upload a payment proof screenshot.
 * Multipart form: file. Returns an opaque storage key to attach to the
 * payment submission. Images only, ≤ 8 MB, rate-limited per user.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "forbidden" }, { status: 403 });
  }
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: auth.status });
  }

  const rl = consumeRateLimit(
    "upload",
    auth.identity.user.id,
    UPLOAD_LIMITS.perUser.limit,
    UPLOAD_LIMITS.perUser.windowMs
  );
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error_key: "rate_limited" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error_key: "file_required" }, { status: 400 });
  }

  const invalid = validateProofFile({ size: file.size, type: file.type });
  if (invalid) {
    return NextResponse.json({ ok: false, error_key: invalid }, { status: 400 });
  }

  const key = newProofKey(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await getStorage().put(key, buffer, file.type);

  return NextResponse.json({ ok: true, proofKey: key }, { status: 201 });
}
