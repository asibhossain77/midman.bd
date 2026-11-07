import type { Metadata } from "next";

import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { requirePageUser } from "@/lib/auth/admin";
import {
  getActionRequiredDealIds,
  getUserStats,
  listDealsForUser,
} from "@/lib/deals/queries";
import { isDatabaseConfigured } from "@/lib/turso/client";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const identity = await requirePageUser();

  const deals = isDatabaseConfigured()
    ? await listDealsForUser(identity.user.id, "all", 8)
    : [];
  const actionIds = isDatabaseConfigured()
    ? await getActionRequiredDealIds(identity.user.id)
    : [];
  const stats = isDatabaseConfigured()
    ? await getUserStats(identity.user.id, actionIds)
    : null;

  return (
    <DashboardContent
      user={identity.user}
      emailVerified={identity.emailVerifiedAt !== null}
      stats={stats}
      deals={deals}
    />
  );
}
