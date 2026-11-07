import type { Metadata } from "next";

import { AdminDeals } from "@/components/admin/admin-deals";
import { requirePageAdmin } from "@/lib/auth/admin";
import { listDealsAdmin } from "@/lib/deals/queries";

export const metadata: Metadata = {
  title: "Deals",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await requirePageAdmin();
  const deals = await listDealsAdmin(300);
  return <AdminDeals deals={deals} initialQuery={q ?? ""} />;
}
