import type { Metadata } from "next";

import { SettingsContent } from "@/components/settings/settings-content";
import { requirePageUser } from "@/lib/auth/admin";
import { getUserById } from "@/lib/auth/users";
import { createEmailToken } from "@/lib/auth/tokens";
import { getSelfOrigin } from "@/lib/auth/config";
import { isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const identity = await requirePageUser();
  const row = await getUserById(identity.user.id);

  // When email delivery is unconfigured outside production, surface the
  // verification link directly so the flow can be completed locally.
  let devVerifyUrl: string | null = null;
  if (row && !row.emailVerifiedAt && !isEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      const token = await createEmailToken(row.id, "verify_email");
      const origin = await getSelfOrigin();
      devVerifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
    }
  }

  return (
    <SettingsContent
      user={{
        id: identity.user.id,
        name: identity.user.name,
        email: identity.user.email,
        role: identity.user.role,
        googleLinked: Boolean(row?.googleId),
        emailVerifiedAt: row?.emailVerifiedAt ?? null,
        createdAt: row?.createdAt ?? new Date(),
      }}
      devVerifyUrl={devVerifyUrl}
    />
  );
}
