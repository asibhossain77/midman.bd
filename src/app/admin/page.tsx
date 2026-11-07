import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requirePageAdmin } from "@/lib/auth/admin";
import { getAdminStats, listDealsAdmin } from "@/lib/deals/queries";
import { isDatabaseConfigured } from "@/lib/turso/client";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const identity = await requirePageAdmin();
  const configured = isDatabaseConfigured();
  const stats = configured ? await getAdminStats() : null;
  const recent = configured ? await listDealsAdmin(8) : [];

  return (
    <AdminDashboard
      adminName={identity.user.name}
      stats={stats}
      recentDeals={recent}
      dbConfigured={configured}
    />
  );
}
