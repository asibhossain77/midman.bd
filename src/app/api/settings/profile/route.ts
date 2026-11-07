import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import { updateProfile } from "@/lib/auth/users";
import { updateProfileSchema, fieldErrors } from "@/lib/auth/validation";
import { isSameOrigin } from "@/lib/http/same-origin";

export const dynamic = "force-dynamic";

/** POST /api/settings/profile — update the display name. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error_key: "forbidden" }, { status: 403 });
  }
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_key: "validation_failed", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  await updateProfile(auth.identity.user.id, { name: parsed.data.name });
  return NextResponse.json({ ok: true });
}
