import type { Metadata } from "next";

import { AdminTransactions } from "@/components/admin/admin-transactions";
import { requirePageAdmin } from "@/lib/auth/admin";
import { listTransactionsAdmin } from "@/lib/deals/queries";

export const metadata: Metadata = {
  title: "Transactions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  await requirePageAdmin();
  const items = await listTransactionsAdmin(200);
  return <AdminTransactions items={items} />;
}
