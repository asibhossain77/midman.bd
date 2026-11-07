import type { Metadata } from "next";

import { ActivityList } from "@/components/activity/activity-list";
import { requirePageUser } from "@/lib/auth/admin";
import { listTransactionsForUser } from "@/lib/deals/queries";

export const metadata: Metadata = {
  title: "Transaction activity",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const identity = await requirePageUser();
  const items = await listTransactionsForUser(identity.user.id, 200);
  return <ActivityList items={items} />;
}
