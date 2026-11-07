import type { Metadata } from "next";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { LandingContent } from "@/components/landing/landing-content";

export const metadata: Metadata = {
  title: "Midman.bd — Bangladesh's Trusted Escrow Platform",
};

/**
 * Public landing page. `?loggedOut=1` / `?error=…` surface the auth
 * banners (the same pattern Verify's hero uses).
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ loggedOut?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <LandingContent
        loggedOut={params.loggedOut === "1"}
        authError={params.error}
      />
      <SiteFooter />
    </div>
  );
}
