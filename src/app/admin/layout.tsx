import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageAdmin } from "@/lib/auth/admin";

/**
 * Admin layout — the server-side authorization boundary for EVERY
 * /admin route. resolveIdentity re-reads the users row, so a role
 * change applies on the next request; non-admins are redirected home.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requirePageAdmin();

  return (
    <AdminShell
      user={{
        id: identity.user.id,
        name: identity.user.name,
        email: identity.user.email,
        role: identity.user.role,
      }}
    >
      {children}
    </AdminShell>
  );
}
