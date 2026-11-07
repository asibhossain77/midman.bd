import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/auth/admin";
import { getUserById, getUserByEmail } from "@/lib/auth/users";
import { recordAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/http/same-origin";
import { toUserRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id] — promote/demote a user's role.
 * Self role-change is refused (an admin can never demote themselves by
 * accident and lock the panel). Every change is audited.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (id === auth.identity.user.id) {
    return NextResponse.json({ ok: false, error_key: "self_guard" }, { status: 400 });
  }

  let role = "";
  try {
    const body = (await request.json()) as { role?: string };
    role = body.role ?? "";
  } catch {
    role = "";
  }
  if (!["admin", "user"].includes(role)) {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  const target = await getUserById(id);
  if (!target) {
    return NextResponse.json({ ok: false, error_key: "not_found" }, { status: 404 });
  }

  const { getDb } = await import("@/lib/turso/client");
  const { users } = await import("@/lib/turso/schema");
  const { eq } = await import("drizzle-orm");
  await getDb()
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, id));

  await recordAudit({
    actorId: auth.identity.user.id,
    action: "user.role_change",
    targetType: "user",
    targetId: id,
    meta: { email: target.email, from: toUserRole(target.role), to: role },
  });

  return NextResponse.json({ ok: true, role });
}
