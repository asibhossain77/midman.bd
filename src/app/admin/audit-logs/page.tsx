import type { Metadata } from "next";

import { AdminAuditLogs } from "@/components/admin/admin-audit-logs";
import { requirePageAdmin } from "@/lib/auth/admin";
import { listAuditLogs } from "@/lib/audit";

export const metadata: Metadata = {
  title: "Audit logs",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requirePageAdmin();
  const items = await listAuditLogs(200);
  return <AdminAuditLogs items={items} />;
}
