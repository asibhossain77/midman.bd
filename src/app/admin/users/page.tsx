import type { Metadata } from "next";

import { AdminUsers } from "@/components/admin/admin-users";
import { requirePageAdmin } from "@/lib/auth/admin";
import { isDatabaseConfigured } from "@/lib/turso/client";
import { listUsersForAdmin } from "@/lib/auth/users";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const identity = await requirePageAdmin();
  const rows = isDatabaseConfigured() ? await listUsersForAdmin(q ?? null) : [];

  return (
    <AdminUsers
      viewerId={identity.user.id}
      initialQuery={q ?? ""}
      users={rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        emailVerified: row.emailVerifiedAt !== null,
        disabled: row.disabledAt !== null,
        dealCount: Number(row.dealCount ?? 0),
        createdAt: row.createdAt,
      }))}
    />
  );
}
