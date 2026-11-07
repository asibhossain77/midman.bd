import type { Metadata } from "next";

import { NotificationsList } from "@/components/notifications/notifications-list";
import { requirePageUser } from "@/lib/auth/admin";
import { listNotifications } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const identity = await requirePageUser();
  const items = await listNotifications(identity.user.id);
  return <NotificationsList items={items} />;
}
