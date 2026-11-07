import type { Metadata } from "next";

import { AdminDisputes } from "@/components/admin/admin-disputes";
import { requirePageAdmin } from "@/lib/auth/admin";
import { listDisputes } from "@/lib/deals/queries";

export const metadata: Metadata = {
  title: "Disputes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  await requirePageAdmin();
  const disputes = await listDisputes(true);
  return <AdminDisputes disputes={disputes} />;
}
