"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, ShieldCheck, UserRound } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatDate, toBnDigits } from "@/lib/i18n/numbers";
import { cn } from "@/lib/utils";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  disabled: boolean;
  dealCount: number;
  createdAt: Date;
}

/** User management — roles change ONLY here (server-guarded + audited). */
export function AdminUsers({
  users,
  viewerId,
  initialQuery = "",
}: {
  users: AdminUserRow[];
  viewerId: string;
  initialQuery?: string;
}) {
  const { dict, lang } = useLanguage();
  const u = dict.admin.users;
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [busyId, setBusyId] = useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const visible = term
    ? users.filter(
        (row) =>
          row.name.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term)
      )
    : users;

  async function setRole(id: string, role: "admin" | "user") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = (await res.json()) as { ok?: boolean; error_key?: string };
      if (res.ok && json.ok) {
        toast({ title: u.roleToast });
        router.refresh();
      } else {
        toast({
          title: dict.common.error,
          description:
            json.error_key === "self_guard"
              ? u.selfGuard
              : dict.auth.errors.generic,
          variant: "destructive",
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {u.title}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{u.subtitle}</p>

      <div className="relative mt-5 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={u.search}
          className="pl-9"
        />
      </div>

      <Card className="mt-5 py-0">
        <CardContent className="overflow-x-auto px-0 py-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium sm:px-5">{u.colName}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{u.colEmail}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{u.colRole}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{u.colDeals}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{u.colJoined}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{dict.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((row) => {
                const isSelf = row.id === viewerId;
                const isAdmin = row.role === "admin";
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 sm:px-5">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <UserRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        {row.name}
                        {isSelf && (
                          <Badge variant="outline" className="text-[10px]">
                            {dict.common.you}
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="max-w-48 truncate px-4 py-3 font-mono text-xs text-muted-foreground sm:px-5">
                      {row.email}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      {isAdmin ? (
                        <Badge className="border-transparent bg-primary text-primary-foreground">
                          <ShieldCheck className="size-3" aria-hidden="true" />
                          {dict.admin.roles.admin}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          {dict.admin.roles.user}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground sm:px-5">
                      {toBnDigits(row.dealCount, lang)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:px-5">
                      {formatDate(row.createdAt, lang)}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">{u.selfGuard}</span>
                      ) : (
                        <Button
                          size="sm"
                          variant={isAdmin ? "outline" : "default"}
                          disabled={busyId === row.id}
                          onClick={() => setRole(row.id, isAdmin ? "user" : "admin")}
                        >
                          {busyId === row.id && (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          )}
                          {isAdmin ? u.demote : u.promote}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className={cn("px-5 py-10 text-center text-sm text-muted-foreground")}>
                    {u.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </Container>
  );
}
