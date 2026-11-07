"use client";

import { useState } from "react";
import Link from "next/link";
import { FilePlus2, Handshake } from "lucide-react";

import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/shared/empty-state";
import { DealStatusBadge } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, formatDate } from "@/lib/i18n/numbers";
import { cn } from "@/lib/utils";
import type { DealSummary, DealsFilter } from "@/lib/deals/queries";

export function DealsList({
  userId,
  deals,
}: {
  userId: string;
  deals: DealSummary[];
}) {
  const { dict, lang } = useLanguage();
  const d = dict.deals;
  const [filter, setFilter] = useState<DealsFilter>("all");

  const filters: { key: DealsFilter; label: string }[] = [
    { key: "all", label: d.filterAll },
    { key: "active", label: d.filterActive },
    { key: "completed", label: d.filterCompleted },
    { key: "disputed", label: d.filterDisputed },
  ];

  const visible = deals.filter((deal) => {
    if (filter === "all") return true;
    if (filter === "active")
      return ["pending_acceptance", "accepted", "payment_submitted", "secured", "delivered"].includes(
        deal.status
      );
    if (filter === "completed") return deal.status === "completed";
    return ["disputed", "refund_requested", "refunded"].includes(deal.status);
  });

  return (
    <Container className="py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-text">
            Escrow
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {d.listTitle}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">{d.listSubtitle}</p>
        </div>
        <Button asChild>
          <Link href="/deals/new">
            <FilePlus2 className="size-4" aria-hidden="true" />
            {d.newDeal}
          </Link>
        </Button>
      </div>

      <div
        role="tablist"
        aria-label={d.listTitle}
        className="mt-6 flex flex-wrap gap-2"
      >
        {filters.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {visible.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={d.emptyTitle}
            description={d.emptyDesc}
            action={
              <Button asChild>
                <Link href="/deals/new">{d.newDeal}</Link>
              </Button>
            }
          />
        ) : (
          <Card className="py-0">
            <CardContent className="px-0 py-0">
              <ul className="divide-y">
                {visible.map((deal) => {
                  const isBuyer = deal.buyerId === userId;
                  return (
                    <li key={deal.id}>
                      <Link
                        href={`/deals/${deal.id}`}
                        className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {deal.code}
                            </span>
                            <DealStatusBadge status={deal.status} dict={dict} />
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">
                            {deal.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {dict.dashboard.counterparty}:{" "}
                            {isBuyer
                              ? `${d.roleSeller} · ${deal.sellerName}`
                              : `${d.roleBuyer} · ${deal.buyerName}`}{" "}
                            · {formatDate(deal.createdAt, lang)}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-bold tabular-nums text-foreground">
                            {formatAmount(deal.amount, lang)}
                          </p>
                          <Badge
                            variant="outline"
                            className="mt-1 text-[11px] font-medium text-muted-foreground"
                          >
                            {isBuyer ? d.roleBuyer : d.roleSeller}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </Container>
  );
}
