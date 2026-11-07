"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, formatDateTime } from "@/lib/i18n/numbers";
import { cn } from "@/lib/utils";
import type { DealTransactionRow } from "@/lib/deals/queries";

/** Platform-wide transaction ledger (append-only). */
export function AdminTransactions({ items }: { items: DealTransactionRow[] }) {
  const { dict, lang } = useLanguage();
  const t = dict.admin.transactions;

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t.title}
      </h1>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
        {t.subtitle}
      </p>

      <Card className="mt-6 py-0">
        <CardContent className="overflow-x-auto px-0 py-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium sm:px-5">{t.colDeal}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{t.colDirection}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{t.colAmount}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{t.colReference}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{t.colStatus}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{t.colDate}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-3 sm:px-5">
                    <Link
                      href={`/deals/${tx.dealId}`}
                      target="_blank"
                      className="group flex items-center gap-1.5"
                    >
                      <span className="font-mono text-xs text-muted-foreground group-hover:text-primary-text">
                        {tx.dealCode}
                      </span>
                      <ExternalLink className="size-3 text-muted-foreground/50" aria-hidden="true" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    {dict.deals.tx[tx.direction as keyof typeof dict.deals.tx] ??
                      tx.direction}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground sm:px-5">
                    {formatAmount(tx.amount, lang)}
                  </td>
                  <td className="max-w-40 truncate px-4 py-3 font-mono text-xs text-muted-foreground sm:px-5">
                    {tx.reference ?? "—"}
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        (tx.status === "verified" || tx.status === "processed") &&
                          "border-verified/50 text-primary-text",
                        tx.status === "rejected" &&
                          "border-destructive/40 text-destructive",
                        (tx.status === "submitted" || tx.status === "pending") &&
                          "border-pending/50 text-pending"
                      )}
                    >
                      {dict.deals.tx[`status_${tx.status}` as keyof typeof dict.deals.tx] ??
                        tx.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:px-5">
                    {formatDateTime(tx.createdAt, lang)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {t.empty}
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
