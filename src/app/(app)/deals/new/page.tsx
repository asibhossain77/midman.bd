import type { Metadata } from "next";

import { CreateDealForm } from "@/components/deals/create-deal-form";
import { requirePageUser } from "@/lib/auth/admin";
import { getPlatformSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "New deal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const identity = await requirePageUser();
  const settings = await getPlatformSettings();

  return (
    <CreateDealForm
      emailVerified={identity.emailVerifiedAt !== null}
      settings={{
        minDealAmount: settings.minDealAmount,
        maxDealAmount: settings.maxDealAmount,
        feePercent: settings.feePercent,
        requireVerifiedEmail: settings.requireVerifiedEmailForDeals,
      }}
    />
  );
}
