"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Banknote,
  CheckCheck,
  ExternalLink,
  FileCheck2,
  Loader2,
  ShieldAlert,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/shared/empty-state";
import { DealStatusBadge } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, formatDateTime } from "@/lib/i18n/numbers";
import type { DealSummary } from "@/lib/deals/queries";

/**
 * Payment verification queue — the admin's money gate. A payment may
 * only be verified after the money REALLY arrived; the confirmation
 * dialog forces that acknowledgement before the secured status lands.
 */
export function AdminPayments({ queue }: { queue: DealSummary[] }) {
  const { dict, lang } = useLanguage();
  const p = dict.admin.payments;
  const router = useRouter();
  const { toast } = useToast();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    null | { deal: DealSummary; action: "verify" | "reject" }
  >(null);
  const [note, setNote] = useState("");

  async function act() {
    if (!confirm) return;
    setBusyId(confirm.deal.id);
    try {
      const res = await fetch(`/api/admin/deals/${confirm.deal.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirm.action, note: note.trim() || null }),
      });
      const json = (await res.json()) as { ok?: boolean; error_key?: string };
      if (res.ok && json.ok) {
        toast({
          title: confirm.action === "verify" ? p.verifiedToast : p.rejectedToast,
        });
        setConfirm(null);
        setNote("");
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
        {p.title}
      </h1>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
        {p.subtitle}
      </p>

      <div className="mt-6">
        {queue.length === 0 ? (
          <EmptyState
            icon={FileCheck2}
            title={p.empty}
            description={dict.admin.dashboard.subtitle}
          />
        ) : (
          <ul className="space-y-4">
            {queue.map((deal) => (
              <li key={deal.id}>
                <Card className="py-0">
                  <CardContent className="px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {deal.code}
                          </span>
                          <DealStatusBadge status={deal.status} dict={dict} />
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-foreground">
                          {deal.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.colBuyer}: {deal.buyerName} ({deal.buyerEmail})
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.colDate}: {formatDateTime(deal.updatedAt, lang)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums text-foreground">
                          {formatAmount(deal.amount, lang)}
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-pending/50 text-[11px] text-pending"
                        >
                          {dict.deals.tx.status_submitted}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <Button
                        disabled={busyId === deal.id}
                        onClick={() => setConfirm({ deal, action: "verify" })}
                      >
                        <CheckCheck className="size-4" aria-hidden="true" />
                        {p.verify}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busyId === deal.id}
                        onClick={() => setConfirm({ deal, action: "reject" })}
                      >
                        <Ban className="size-4" aria-hidden="true" />
                        {p.reject}
                      </Button>
                      <Button variant="ghost" asChild className="text-muted-foreground">
                        <a href={`/api/media/payment-proof/${deal.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-4" aria-hidden="true" />
                          {p.viewProof}
                        </a>
                      </Button>
                      <Button variant="ghost" asChild className="text-muted-foreground">
                        <a href={`/deals/${deal.id}`} target="_blank" rel="noopener noreferrer">
                          {dict.common.viewDetails}
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            setNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === "verify" ? p.verify : p.reject}
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === "verify" ? p.verifyConfirm : p.rejectConfirm}
            </DialogDescription>
          </DialogHeader>
          {confirm?.action === "verify" && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {dict.footer.securityNote}
            </div>
          )}
          {confirm?.action === "reject" && (
            <div className="space-y-1.5">
              <Label htmlFor="reject-note">{dict.common.notes}</Label>
              <Textarea
                id="reject-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirm(null);
                setNote("");
              }}
              disabled={busyId !== null}
            >
              {dict.common.cancel}
            </Button>
            <Button
              variant={confirm?.action === "verify" ? "default" : "destructive"}
              onClick={act}
              disabled={busyId !== null}
            >
              {busyId && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {confirm?.action === "verify" ? (
                <>
                  <Banknote className="size-4" aria-hidden="true" />
                  {p.verify}
                </>
              ) : (
                p.reject
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
