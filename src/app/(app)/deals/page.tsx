import type { Metadata } from "next";

import { DealsList } from "@/components/deals/deals-list";
import { requirePageUser } from "@/lib/auth/admin";
import { listDealsForUser } from "@/lib/deals/queries";
import { isDatabaseConfigured } from "@/lib/turso/client";

export const metadata: Metadata = {
  title: "Deals",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const identity = await requirePageUser();
  const deals = isDatabaseConfigured()
    ? await listDealsForUser(identity.user.id, "all", 200)
    : [];

  return <DealsList userId={identity.user.id} deals={deals} />;
}
