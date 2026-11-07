import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DealDetailView } from "@/components/deals/deal-detail";
import { requirePageUser } from "@/lib/auth/admin";
import {
  getDealEvents,
  getDealForUser,
  getDealTransactions,
  listActivePaymentMethods,
} from "@/lib/deals/queries";

export const metadata: Metadata = {
  title: "Deal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const identity = await requirePageUser();

  const deal = await getDealForUser(id, identity.user.id);
  if (!deal) notFound();

  const [events, transactions, methods] = await Promise.all([
    getDealEvents(id),
    getDealTransactions(id),
    listActivePaymentMethods(),
  ]);

  return (
    <DealDetailView
      deal={deal}
      events={events}
      transactions={transactions}
      methods={methods.map((m) => ({
        id: m.id,
        name: m.name,
        account: m.account,
        instructions: m.instructions,
      }))}
      viewerId={identity.user.id}
      created={created === "1"}
    />
  );
}
