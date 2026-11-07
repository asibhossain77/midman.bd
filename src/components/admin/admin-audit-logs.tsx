"use client";

import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatDateTime } from "@/lib/i18n/numbers";
import type { AuditRow } from "@/lib/audit";

/** Audit logs — every privileged action, permanent record. */
export function AdminAuditLogs({ items }: { items: AuditRow[] }) {
  const { dict, lang } = useLanguage();
  const a = dict.admin.audit;

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {a.title}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{a.subtitle}</p>

      <Card className="mt-6 py-0">
        <CardContent className="overflow-x-auto px-0 py-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium sm:px-5">{a.colActor}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{a.colAction}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{a.colTarget}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{a.colDate}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-foreground sm:px-5">
                    {row.actorName ?? row.actorId ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-primary-text sm:px-5">
                    {row.action}
                  </td>
                  <td className="max-w-48 truncate px-4 py-3 font-mono text-xs text-muted-foreground sm:px-5">
                    {row.targetType ? `${row.targetType}:${row.targetId ?? ""}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:px-5">
                    {formatDateTime(row.createdAt, lang)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {a.empty}
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
