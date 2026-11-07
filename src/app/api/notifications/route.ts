import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/admin";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** GET /api/notifications — the signed-in user's notifications. */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: auth.status });
  }
  const items = await listNotifications(auth.identity.user.id);
  return NextResponse.json({ ok: true, items });
}

/** POST /api/notifications — mark one or all as read. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error_key: "unauthorized" }, { status: auth.status });
  }
  let body: { action?: string; id?: string };
  try {
    body = (await request.json()) as { action?: string; id?: string };
  } catch {
    return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
  }

  if (body.action === "mark_all_read") {
    await markAllNotificationsRead(auth.identity.user.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "mark_read" && typeof body.id === "string") {
    await markNotificationRead(auth.identity.user.id, body.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error_key: "invalid_input" }, { status: 400 });
}
