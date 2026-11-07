"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  FilePlus2,
  Handshake,
  Lock,
  MailCheck,
  ShieldAlert,
  UserCheck,
  Wallet,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/shared/empty-state";
import { DealStatusBadge, StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, formatDate, toBnDigits } from "@/lib/i18n/numbers";
import type { DealSummary } from "@/lib/deals/queries";
import type { UserStats } from "@/lib/deals/queries";

interface Props {
  user: { id: string; name: string; email: string; role: string };
  emailVerified: boolean;
  stats: UserStats | null;
  deals: DealSummary[];
}

/**
 * User dashboard — the Verify dashboard design language: welcome
 * heading + muted subtitle, amber status banner, stat-card grid and a
 * recent-deals table. All values are real DB counts (never invented).
 */
export function DashboardContent({ user, emailVerified, stats, deals }: Props) {
  const { dict, lang } = useLanguage();
  const d = dict.dashboard;

  const counterpartyOf = (deal: DealSummary) => {
    const isBuyer = deal.buyerId === user.id;
    return {
      label: isBuyer ? dict.deals.roleSeller : dict.deals.roleBuyer,
      name: isBuyer ? deal.sellerName : deal.buyerName,
    };
  };

  return (
    <Container className="py-8 sm:py-10">
      {/* Welcome header */}
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-text">
        {d.title}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {d.welcome}, {user.name}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{d.subtitle}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/deals/new">
            <FilePlus2 className="size-4" aria-hidden="true" />
            {d.newDeal}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/deals">
            {d.recentDeals}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {/* Unverified email banner */}
      {!emailVerified && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-pending/40 bg-pending/10 px-4 py-3 text-sm">
          <MailCheck className="size-4 shrink-0 text-pending" aria-hidden="true" />
          <span className="flex-1 text-foreground">{dict.auth.unverifiedBanner}</span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">{dict.settings.verifyNow}</Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            icon={Handshake}
            label={d.stats.totalDeals}
            value={toBnDigits(stats.totalDeals, lang)}
            hint={d.statsHelp.totalDeals}
          />
          <StatCard
            icon={ArrowRight}
            label={d.stats.activeDeals}
            value={toBnDigits(stats.activeDeals, lang)}
            hint={d.statsHelp.activeDeals}
          />
          <StatCard
            icon={Wallet}
            label={d.stats.pendingPayments}
            value={toBnDigits(stats.pendingPayments, lang)}
            hint={d.statsHelp.pendingPayments}
            tone={stats.pendingPayments > 0 ? "warning" : "default"}
          />
          <StatCard
            icon={Lock}
            label={d.stats.securedValue}
            value={formatAmount(stats.securedValue, lang)}
            hint={d.statsHelp.securedValue}
            tone="positive"
          />
          <StatCard
            icon={ShieldAlert}
            label={d.stats.disputedDeals}
            value={toBnDigits(stats.disputedDeals, lang)}
            hint={d.statsHelp.disputedDeals}
            tone={stats.disputedDeals > 0 ? "danger" : "default"}
          />
          <StatCard
            icon={UserCheck}
            label={d.stats.awaitingYourAction}
            value={toBnDigits(stats.awaitingYourAction, lang)}
            hint={d.statsHelp.awaitingYourAction}
          />
        </div>
      )}

      {/* Recent deals */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{d.recentDeals}</h2>
          <Link
            href="/deals"
            className="text-sm font-medium text-primary-text hover:underline"
          >
            {d.viewAll}
          </Link>
        </div>

        {deals.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={d.emptyTitle}
            description={d.emptyDesc}
            action={
              <Button asChild>
                <Link href="/deals/new">{d.emptyAction}</Link>
              </Button>
            }
          />
        ) : (
          <Card className="py-0">
            <CardContent className="px-0 py-0">
              <ul className="divide-y">
                {deals.map((deal) => {
                  const other = counterpartyOf(deal);
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
                            {d.counterparty}: {other.name} · {formatDate(deal.createdAt, lang)}
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
                            {other.label}
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
