"use client";

import { HandCoins, ReceiptText } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, formatDateTime } from "@/lib/i18n/numbers";
import { cn } from "@/lib/utils";
import type { DealTransactionRow } from "@/lib/deals/queries";

/**
 * Transaction activity — the user's money ledger. Append-only by
 * contract: entries are never edited, so this list is the honest record.
 */
export function ActivityList({ items }: { items: DealTransactionRow[] }) {
  const { dict, lang } = useLanguage();
  const a = dict.activity;

  return (
    <Container className="py-8 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-text">
        {dict.deals.detail.activity}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {a.title}
      </h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
        {a.subtitle}
      </p>

      <div className="mt-6">
        {items.length === 0 ? (
          <Card className="py-0">
            <CardContent className="flex flex-col items-center px-6 py-16 text-center">
              <ReceiptText className="size-8 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {a.emptyTitle}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{a.emptyDesc}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="py-0">
            <CardContent className="overflow-x-auto px-0 py-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium sm:px-5">{a.colDeal}</th>
                    <th className="px-4 py-3 font-medium sm:px-5">{a.colDirection}</th>
                    <th className="px-4 py-3 font-medium sm:px-5">{a.colAmount}</th>
                    <th className="px-4 py-3 font-medium sm:px-5">{a.colReference}</th>
                    <th className="px-4 py-3 font-medium sm:px-5">{a.colStatus}</th>
                    <th className="px-4 py-3 font-medium sm:px-5">{a.colDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((tx) => (
                    <tr key={tx.id}>
                      <td className="max-w-48 px-4 py-3 sm:px-5">
                        <span className="font-mono text-xs text-muted-foreground">
                          {tx.dealCode}
                        </span>
                        <span className="block truncate text-sm text-foreground">
                          {tx.dealTitle}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-sm",
                            tx.direction === "payment_in" && "text-foreground",
                            tx.direction === "payout_out" && "text-primary-text",
                            tx.direction === "refund_out" && "text-pending"
                          )}
                        >
                          <HandCoins className="size-3.5" aria-hidden="true" />
                          {dict.deals.tx[tx.direction as keyof typeof dict.deals.tx] ??
                            tx.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-foreground sm:px-5">
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
                          {dict.deals.tx[
                            `status_${tx.status}` as keyof typeof dict.deals.tx
                          ] ?? tx.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:px-5">
                        {formatDateTime(tx.createdAt, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Container>
  );
}
