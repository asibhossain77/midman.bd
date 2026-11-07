"use client";

import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Banknote,
  FileCheck2,
  Handshake,
  Lock,
  ShieldAlert,
  Undo2,
  UserCheck,
  Users,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { DealStatusBadge, StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, formatDateTime, toBnDigits } from "@/lib/i18n/numbers";
import type { AdminStats, DealSummary } from "@/lib/deals/queries";

/**
 * Admin dashboard — live counts from the escrow database plus the
 * latest deals. When the database is not configured the honest
 * "unavailable" banner replaces the numbers (never fake data).
 */
export function AdminDashboard({
  adminName,
  stats,
  recentDeals,
  dbConfigured,
}: {
  adminName: string;
  stats: AdminStats | null;
  recentDeals: DealSummary[];
  dbConfigured: boolean;
}) {
  const { dict, lang } = useLanguage();
  const a = dict.admin.dashboard;
  const d = dict.deals;

  return (
    <Container className="py-8 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-text">
        {dict.admin.panel}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {a.welcome}, {adminName}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{a.subtitle}</p>

      {!dbConfigured && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-pending/40 bg-pending/10 px-4 py-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-pending" aria-hidden="true" />
          <span className="leading-relaxed text-foreground">{a.dbUnavailable}</span>
        </div>
      )}

      {stats && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label={a.users}
            value={toBnDigits(stats.users, lang)}
          />
          <StatCard
            icon={Handshake}
            label={a.deals}
            value={toBnDigits(stats.deals, lang)}
          />
          <StatCard
            icon={ArrowRight}
            label={a.activeDeals}
            value={toBnDigits(stats.activeDeals, lang)}
          />
          <StatCard
            icon={UserCheck}
            label={a.completedDeals}
            value={toBnDigits(stats.completedDeals, lang)}
            tone="positive"
          />
          <StatCard
            icon={FileCheck2}
            label={a.pendingPayments}
            value={toBnDigits(stats.pendingPayments, lang)}
            tone={stats.pendingPayments > 0 ? "warning" : "default"}
          />
          <StatCard
            icon={Ban}
            label={a.disputedDeals}
            value={toBnDigits(stats.disputedDeals, lang)}
            tone={stats.disputedDeals > 0 ? "danger" : "default"}
          />
          <StatCard
            icon={Undo2}
            label={a.pendingRefunds}
            value={toBnDigits(stats.pendingRefunds, lang)}
            tone={stats.pendingRefunds > 0 ? "warning" : "default"}
          />
          <StatCard
            icon={Banknote}
            label={a.payoutPending}
            value={toBnDigits(stats.payoutsPending, lang)}
          />
          <StatCard
            icon={Lock}
            label={a.securedValue}
            value={formatAmount(stats.securedValue, lang)}
            tone="positive"
          />
        </div>
      )}

      {/* Latest deals */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{a.recentDeals}</h2>
          <Link
            href="/admin/deals"
            className="text-sm font-medium text-primary-text hover:underline"
          >
            {dict.dashboard.viewAll}
          </Link>
        </div>
        <Card className="py-0">
          <CardContent className="px-0 py-0">
            <ul className="divide-y">
              {recentDeals.map((deal) => (
                <li key={deal.id}>
                  <Link
                    href={`/admin/deals?q=${deal.code}`}
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
                        {d.detail.buyer}: {deal.buyerName} → {d.detail.seller}:{" "}
                        {deal.sellerName} · {formatDateTime(deal.createdAt, lang)}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-foreground sm:text-right">
                      {formatAmount(deal.amount, lang)}
                    </p>
                  </Link>
                </li>
              ))}
              {recentDeals.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                  —
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
