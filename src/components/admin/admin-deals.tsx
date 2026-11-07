"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, ExternalLink, Loader2, Search } from "lucide-react";

import { Container } from "@/components/layout/container";
import { DealStatusBadge } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, formatDate } from "@/lib/i18n/numbers";
import { isPayoutEligible } from "@/lib/deals/status";
import type { DealSummary } from "@/lib/deals/queries";

/**
 * Deal management — every platform deal with its full state; admins can
 * release eligible payouts (completed, no active dispute/refund).
 */
export function AdminDeals({
  deals,
  initialQuery = "",
}: {
  deals: DealSummary[];
  initialQuery?: string;
}) {
  const { dict, lang } = useLanguage();
  const dm = dict.admin.deals;
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = useState(initialQuery);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payout, setPayout] = useState<DealSummary | null>(null);
  const [reference, setReference] = useState("");

  const term = query.trim().toLowerCase();
  const visible = term
    ? deals.filter(
        (d) =>
          d.code.toLowerCase().includes(term) ||
          d.title.toLowerCase().includes(term) ||
          d.buyerEmail.toLowerCase().includes(term) ||
          d.sellerEmail.toLowerCase().includes(term)
      )
    : deals;

  async function releasePayout() {
    if (!payout) return;
    setBusyId(payout.id);
    try {
      const res = await fetch(`/api/admin/deals/${payout.id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: reference.trim() || null }),
      });
      const json = (await res.json()) as { ok?: boolean; error_key?: string };
      if (res.ok && json.ok) {
        toast({ title: dict.admin.refunds.processedToast });
        setPayout(null);
        setReference("");
        router.refresh();
      } else {
        toast({
          title: dict.common.error,
          description:
            dict.auth.errors[
              (json.error_key ?? "generic") as keyof typeof dict.auth.errors
            ],
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
        {dm.title}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{dm.subtitle}</p>

      <div className="relative mt-5 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.admin.users.search}
          className="pl-9"
        />
      </div>

      <Card className="mt-5 py-0">
        <CardContent className="overflow-x-auto px-0 py-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium sm:px-5">{dm.colCode}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{dm.colTitle}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{dm.colBuyer}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{dm.colSeller}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{dm.colAmount}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{dm.colStatus}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{dm.colCreated}</th>
                <th className="px-4 py-3 font-medium sm:px-5">{dict.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((deal) => {
                const payoutEligible = isPayoutEligible(deal);
                return (
                  <tr key={deal.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground sm:px-5">
                      {deal.code}
                    </td>
                    <td className="max-w-44 px-4 py-3 sm:px-5">
                      <span className="block truncate font-medium text-foreground">
                        {deal.title}
                      </span>
                    </td>
                    <td className="max-w-36 truncate px-4 py-3 text-muted-foreground sm:px-5">
                      {deal.buyerName}
                    </td>
                    <td className="max-w-36 truncate px-4 py-3 text-muted-foreground sm:px-5">
                      {deal.sellerName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground sm:px-5">
                      {formatAmount(deal.amount, lang)}
                      {deal.payoutStatus === "paid" && (
                        <span className="block text-[10px] font-medium text-primary-text">
                          payout ✓
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <DealStatusBadge status={deal.status} dict={dict} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:px-5">
                      {formatDate(deal.createdAt, lang)}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-1.5">
                        {payoutEligible && (
                          <Button
                            size="sm"
                            disabled={busyId === deal.id}
                            onClick={() => setPayout(deal)}
                          >
                            <Banknote className="size-3.5" aria-hidden="true" />
                            {dict.admin.refunds.process}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" asChild className="text-muted-foreground">
                          <a href={`/deals/${deal.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {dict.admin.users.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Payout dialog */}
      <Dialog
        open={payout !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPayout(null);
            setReference("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dict.admin.refunds.process} — {payout?.code}
            </DialogTitle>
            <DialogDescription>
              {dict.admin.refunds.processConfirm}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="payout-ref">{dict.activity.colReference}</Label>
            <Input
              id="payout-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPayout(null);
                setReference("");
              }}
              disabled={busyId !== null}
            >
              {dict.common.cancel}
            </Button>
            <Button onClick={releasePayout} disabled={busyId !== null}>
              {busyId && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <Banknote className="size-4" aria-hidden="true" />
              {dict.admin.refunds.process}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
