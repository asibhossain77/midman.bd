import type { Metadata } from "next";

import { AdminPayments } from "@/components/admin/admin-payments";
import { requirePageAdmin } from "@/lib/auth/admin";
import { listPaymentQueue } from "@/lib/deals/queries";

export const metadata: Metadata = {
  title: "Payment verification",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requirePageAdmin();
  const queue = await listPaymentQueue();
  return <AdminPayments queue={queue} />;
}
