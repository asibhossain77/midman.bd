import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { requirePageUser } from "@/lib/auth/admin";

/**
 * Layout for the logged-in area (dashboard, deals, notifications,
 * activity, settings). The edge proxy does the presence check; this
 * layout performs the REAL verification and identity refresh against
 * the database, then renders the standard site chrome.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageUser();

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
