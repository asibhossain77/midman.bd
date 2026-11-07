import type { Metadata } from "next";

import { AdminSettings } from "@/components/admin/admin-settings";
import { requirePageAdmin } from "@/lib/auth/admin";
import { getPlatformSettings } from "@/lib/settings";
import { listAllPaymentMethods } from "@/lib/deals/queries";

export const metadata: Metadata = {
  title: "Platform settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePageAdmin();
  const [settings, methods] = await Promise.all([
    getPlatformSettings(),
    listAllPaymentMethods(),
  ]);

  return (
    <AdminSettings
      settings={settings}
      methods={methods.map((m) => ({
        id: m.id,
        name: m.name,
        account: m.account,
        instructions: m.instructions,
        isActive: m.isActive,
      }))}
    />
  );
}
