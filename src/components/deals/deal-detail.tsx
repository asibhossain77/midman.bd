"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Banknote,
  CheckCheck,
  CircleAlert,
  Copy,
  FileText,
  Handshake,
  Info,
  Lock,
  PackageCheck,
  ScrollText,
  Send,
  ShieldCheck,
  Undo2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";

import { Container } from "@/components/layout/container";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DealStatusBadge } from "@/components/shared/stat-card";
import { useLanguage } from "@/lib/i18n/language-context";
import { useToast } from "@/hooks/use-toast";
import { formatAmount, formatDateTime } from "@/lib/i18n/numbers";
import { cn } from "@/lib/utils";
import type { DealDetail, DealTransactionRow, DealEventRow } from "@/lib/deals/queries";
import {
  canAccept,
  canCancel,
  canConfirm,
  canDeliver,
  canOpenDispute,
  canRequestRefund,
  canSubmitPayment,
  isPayoutEligible,
  nextActor,
  roleOf,
  type DealRole,
} from "@/lib/deals/status";

export interface PaymentMethodOption {
  id: string;
  name: string;
  account: string;
  instructions: string | null;
}

interface Props {
  deal: DealDetail;
  events: DealEventRow[];
  transactions: DealTransactionRow[];
  methods: PaymentMethodOption[];
  viewerId: string;
  created: boolean;
}

/**
 * Deal detail — the full escrow sheet: status, parties, terms, payment
 * instructions, role-aware actions, the append-only timeline and the
 * money ledger. Every action posts to the server and the page state is
 * refreshed from the DB — the client never decides the outcome.
 */
export function DealDetailView({
  deal,
  events,
  transactions,
  methods,
  viewerId,
  created,
}: Props) {
  const { dict, lang } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const d = dict.deals;

  const role = roleOf(deal, viewerId) as DealRole;
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<
    null | "pay" | "deliver" | "confirm" | "dispute" | "refund" | "cancel"
  >(null);
  const [copied, setCopied] = useState(false);

  // payment dialog fields
  const [methodId, setMethodId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [sender, setSender] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  // other dialogs
  const [note, setNote] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [cancelChecked, setCancelChecked] = useState(false);

  const isBuyer = deal.buyerId === viewerId;
  const other = isBuyer ? deal.sellerName : deal.buyerName;
  const payout = Math.max(0, deal.amount - deal.feeAmount);
  const next = nextActor({ ...deal, createdByRole: deal.createdByRole as DealRole });

  const canPay = role !== null && canSubmitPayment(deal, viewerId);
  const canAcceptNow = role !== null && canAccept({ ...deal, createdByRole: deal.createdByRole as DealRole }, viewerId);
  const canCancelNow = role !== null && canCancel(deal, viewerId);
  const canDeliverNow = role !== null && canDeliver(deal, viewerId);
  const canConfirmNow = role !== null && canConfirm(deal, viewerId);
  const canDispute = role !== null && canOpenDispute(deal, viewerId);
  const canRefund = role !== null && canRequestRefund(deal, viewerId);
  const payoutEligible = isPayoutEligible({ ...deal, payoutStatus: deal.payoutStatus });

  function closeDialog() {
    setDialog(null);
    setNote("");
    setReference("");
    setSender("");
    setProofFile(null);
    setConfirmChecked(false);
    setCancelChecked(false);
  }

  function toastError(code: string) {
    const key = (["invalid_state", "dispute_active", "duplicate_payment", "file_required", "file_too_large", "file_type", "invalid_input", "generic"] as const).includes(
      code as never
    )
      ? (code as keyof typeof dict.auth.errors)
      : "generic";
    toast({
      title: dict.common.error,
      description: dict.auth.errors[key],
      variant: "destructive",
    });
  }

  async function postAction(
    path: string,
    body: Record<string, unknown>
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; error_key?: string };
      if (!res.ok || !json.ok) {
        toastError(json.error_key ?? "generic");
        return false;
      }
      return true;
    } catch {
      toastError("generic");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment() {
    if (!methodId) {
      toastError("invalid_input");
      return;
    }
    if (reference.trim().length < 3) {
      toastError("invalid_input");
      return;
    }
    setBusy(true);
    try {
      let proofKey: string | null = null;
      if (proofFile) {
        const form = new FormData();
        form.append("file", proofFile);
        const uploadRes = await fetch("/api/uploads/payment-proof", {
          method: "POST",
          body: form,
        });
        const uploadJson = (await uploadRes.json()) as {
          ok?: boolean;
          proofKey?: string;
          error_key?: string;
        };
        if (!uploadRes.ok || !uploadJson.ok || !uploadJson.proofKey) {
          toastError(uploadJson.error_key ?? "file_required");
          return;
        }
        proofKey = uploadJson.proofKey;
      }

      const ok = await postAction(`/api/deals/${deal.id}/payment`, {
        methodId,
        reference: reference.trim(),
        sender: sender.trim() || null,
        proofKey,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!ok) return;

      toast({
        title: d.detail.paySubmittedToast,
        description: (
          <span>
            <ShieldCheck className="mr-1 inline size-3.5 text-primary-text" aria-hidden="true" />
            {deal.code}
          </span>
        ) as unknown as string,
      });
      closeDialog();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function simpleAction(
    path: string,
    body: Record<string, unknown>,
    successText: string
  ) {
    const ok = await postAction(path, body);
    if (ok) {
      toast({ title: successText });
      closeDialog();
      router.refresh();
    }
  }

  function copyCode() {
    void navigator.clipboard.writeText(deal.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const waitingText: Record<string, string> = {
    pending_acceptance: d.detail.waitingAcceptance,
    accepted: d.detail.waitingBuyerPayment,
    payment_submitted: d.detail.waitingAdminVerify,
    secured: d.detail.waitingDelivery,
    delivered: d.detail.waitingConfirmation,
    refund_requested: d.detail.waitingAdminRefund,
  };

  return (
    <Container className="max-w-4xl py-8 sm:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" asChild className="px-2 text-muted-foreground">
          <Link href="/deals">
            <ArrowRight className="size-4 rotate-180" aria-hidden="true" />
            {dict.common.backToDeals}
          </Link>
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
          title={dict.common.copy}
        >
          {deal.code}
          {copied ? (
            <BadgeCheck className="size-3.5 text-primary-text" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
        </button>
        <DealStatusBadge status={deal.status} dict={dict} />
        {deal.payoutStatus === "paid" && (
          <Badge className="border-transparent bg-verified text-verified-foreground">
            <Banknote className="size-3" aria-hidden="true" />
            {dict.deals.tx.payout_out} ✓
          </Badge>
        )}
      </div>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {deal.title}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {formatDateTime(deal.createdAt, lang)}
      </p>

      {/* Status banners */}
      {created && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-verified/40 bg-verified/5 px-4 py-3 text-sm text-foreground">
          <CheckCheck className="size-4 shrink-0 text-primary-text" aria-hidden="true" />
          {d.create.createdToast}
        </div>
      )}
      {deal.status === "disputed" && (
        <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <ShieldCheck className="size-4 rotate-180" aria-hidden="true" />
            <Ban className="size-4" aria-hidden="true" />
            {d.detail.disputeBannerTitle}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {d.detail.disputeBannerBody}
          </p>
        </div>
      )}
      {deal.status === "refunded" && (
        <div className="mt-5 rounded-xl border border-border bg-muted px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{d.detail.refundedBannerTitle}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{d.detail.refundedBannerBody}</p>
        </div>
      )}
      {deal.status === "secured" && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-verified/40 bg-verified/5 px-4 py-3 text-sm text-foreground">
          <Lock className="size-4 shrink-0 text-primary-text" aria-hidden="true" />
          {d.statusHelp.secured}
        </div>
      )}

      {/* Amount card */}
      <Card className="mt-6 py-0">
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {dict.common.amount}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatAmount(deal.amount, lang)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {dict.common.fee}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-muted-foreground">
              {formatAmount(deal.feeAmount, lang)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {dict.common.payout}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-primary-text">
              {formatAmount(payout, lang)}
            </p>
            {payoutEligible && (
              <Badge className="mt-1 border-transparent bg-verified text-verified-foreground">
                {dict.dashboard.stats.awaitingYourAction === "" ? "" : "payout pending"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parties */}
      <Card className="mt-5 py-0">
        <CardContent className="px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-primary-text" aria-hidden="true" />
            {d.detail.parties}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <UserRound className="size-3.5" aria-hidden="true" />
                {d.detail.buyer}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">
                {deal.buyerName}
                {isBuyer && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {dict.common.you}
                  </Badge>
                )}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{deal.buyerEmail}</p>
            </div>
            <div className="rounded-lg border bg-background p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <PackageCheck className="size-3.5" aria-hidden="true" />
                {d.detail.seller}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">
                {deal.sellerName}
                {!isBuyer && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {dict.common.you}
                  </Badge>
                )}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{deal.sellerEmail}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {isBuyer
              ? deal.createdByRole === "buyer"
                ? d.createdAsBuyer
                : d.invitedBuyer
              : deal.createdByRole === "seller"
                ? d.createdAsSeller
                : d.invitedSeller}
          </p>
        </CardContent>
      </Card>

      {/* Description + terms */}
      <Card className="mt-5 py-0">
        <CardContent className="px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="size-4 text-primary-text" aria-hidden="true" />
            {d.detail.description}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {deal.description ?? "—"}
          </p>
          <Separator className="my-4" />
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ScrollText className="size-4 text-primary-text" aria-hidden="true" />
            {d.detail.terms}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {deal.terms ?? d.detail.noTerms}
          </p>
        </CardContent>
      </Card>

      {/* Payment instructions (buyer needs to pay) */}
      {canPay && methods.length > 0 && (
        <Card className="mt-5 border-primary/30 py-0">
          <CardContent className="px-5 py-5 sm:px-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Banknote className="size-4 text-primary-text" aria-hidden="true" />
              {d.detail.payInstructionsTitle}
            </h2>
            <ul className="mt-3 space-y-3">
              {methods.map((m) => (
                <li key={m.id} className="rounded-lg border bg-background p-3.5">
                  <p className="text-sm font-semibold text-foreground">{m.name}</p>
                  <p className="mt-1 font-mono text-sm text-primary-text">{m.account}</p>
                  {m.instructions && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {m.instructions}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-pending" aria-hidden="true" />
              {d.detail.payDesc}
            </p>
          </CardContent>
        </Card>
      )}
      {canPay && methods.length === 0 && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-pending/40 bg-pending/10 px-4 py-3 text-sm">
          <CircleAlert className="size-4 shrink-0 text-pending" aria-hidden="true" />
          {d.detail.payNoMethods}
        </div>
      )}

      {/* Actions */}
      {(canAcceptNow ||
        canCancelNow ||
        canPay ||
        canDeliverNow ||
        canConfirmNow ||
        canDispute ||
        canRefund) && (
        <div className="mt-6 flex flex-wrap gap-2.5">
          {canAcceptNow && (
            <Button
              disabled={busy}
              onClick={() =>
                simpleAction(`/api/deals/${deal.id}/accept`, {}, dict.deals.statusHelp.accepted)
              }
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              {d.detail.actionAccept}
            </Button>
          )}
          {canPay && (
            <Button disabled={busy} onClick={() => setDialog("pay")}>
              <Banknote className="size-4" aria-hidden="true" />
              {d.detail.actionPay}
            </Button>
          )}
          {canDeliverNow && (
            <Button disabled={busy} onClick={() => setDialog("deliver")}>
              <Send className="size-4" aria-hidden="true" />
              {d.detail.actionDeliver}
            </Button>
          )}
          {canConfirmNow && (
            <Button disabled={busy} onClick={() => setDialog("confirm")}>
              <CheckCheck className="size-4" aria-hidden="true" />
              {d.detail.actionConfirm}
            </Button>
          )}
          {canCancelNow && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDialog("cancel")}
            >
              <Ban className="size-4" aria-hidden="true" />
              {d.detail.actionCancel}
            </Button>
          )}
          {canRefund && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDialog("refund")}
            >
              <Undo2 className="size-4" aria-hidden="true" />
              {d.detail.actionRefund}
            </Button>
          )}
          {canDispute && deal.status !== "disputed" && (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => setDialog("dispute")}
            >
              <ShieldCheck className="size-4 rotate-180" aria-hidden="true" />
              {d.detail.actionDispute}
            </Button>
          )}
        </div>
      )}

      {/* Waiting line */}
      {waitingText[deal.status] && (
        <p className="mt-4 text-sm text-muted-foreground">
          {d.detail.waitingFor}{" "}
          <span className="font-medium text-foreground">
            {next === "admin"
              ? waitingText[deal.status]
              : next === role
                ? waitingText[deal.status]
                : waitingText[deal.status]}
          </span>
          {next === role && (
            <Badge className="ml-2 border-transparent bg-pending text-pending-foreground">
              {dict.dashboard.stats.awaitingYourAction}
            </Badge>
          )}
        </p>
      )}

      {/* Timeline */}
      <Card className="mt-8 py-0">
        <CardContent className="px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Handshake className="size-4 text-primary-text" aria-hidden="true" />
            {d.detail.timeline}
          </h2>
          <ol className="mt-4 space-y-4">
            {events.map((event) => (
              <li key={event.id} className="relative flex gap-3 pl-1">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {dict.deals.events[event.type as keyof typeof dict.deals.events] ??
                      event.type}
                  </p>
                  {event.detail && (
                    <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {event.detail}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt, lang)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Transactions */}
      {transactions.length > 0 && (
        <Card className="mt-5 py-0">
          <CardContent className="px-5 py-5 sm:px-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Banknote className="size-4 text-primary-text" aria-hidden="true" />
              {d.detail.activity}
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{dict.activity.colDirection}</th>
                    <th className="pb-2 pr-3 font-medium">{dict.common.amount}</th>
                    <th className="pb-2 pr-3 font-medium">{dict.activity.colReference}</th>
                    <th className="pb-2 font-medium">{dict.common.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="align-middle">
                      <td className="py-2.5 pr-3 text-foreground">
                        {dict.deals.tx[tx.direction as keyof typeof dict.deals.tx] ?? tx.direction}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-foreground">
                        {formatAmount(tx.amount, lang)}
                      </td>
                      <td className="max-w-40 truncate py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                        {tx.reference ?? "—"}
                        {tx.proofKey && (
                          <a
                            href={`/api/media/payment-proof/${deal.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-primary-text hover:underline"
                          >
                            {d.detail.actionViewProof}
                          </a>
                        )}
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px]",
                            tx.status === "verified" ||
                              tx.status === "processed"
                              ? "border-verified/50 text-primary-text"
                              : tx.status === "rejected"
                                ? "border-destructive/40 text-destructive"
                                : "text-muted-foreground"
                          )}
                        >
                          {dict.deals.tx[`status_${tx.status}` as keyof typeof dict.deals.tx] ??
                            tx.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --------------------------- Dialogs --------------------------- */}
      {/* Pay */}
      <Dialog open={dialog === "pay"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{d.detail.payTitle}</DialogTitle>
            <DialogDescription>{d.detail.payDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{d.detail.payMethod}</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={d.detail.payMethod} />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} — {m.account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref">{d.detail.payReference}</Label>
              <Input
                id="ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={d.detail.payReferencePlaceholder}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">{d.detail.payReferenceHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sender">{d.detail.paySender}</Label>
              <Input
                id="sender"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder={d.detail.paySenderPlaceholder}
              />
              <p className="text-xs text-muted-foreground">{d.detail.paySenderHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proof">{d.detail.payProof}</Label>
              <Input
                id="proof"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-primary-text"
              />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Upload className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {d.detail.payProofHint}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>
              {dict.common.cancel}
            </Button>
            <Button onClick={submitPayment} disabled={busy}>
              {busy ? dict.common.submitting : d.detail.paySubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver */}
      <Dialog open={dialog === "deliver"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{d.detail.deliverTitle}</DialogTitle>
            <DialogDescription>{d.detail.deliverDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="dnote">{d.detail.deliverNote}</Label>
            <Textarea
              id="dnote"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={d.detail.deliverNotePlaceholder}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>
              {dict.common.cancel}
            </Button>
            <Button
              onClick={() =>
                simpleAction(
                  `/api/deals/${deal.id}/deliver`,
                  { note: note.trim() || null },
                  d.detail.deliverToast
                )
              }
              disabled={busy}
            >
              {busy ? dict.common.submitting : d.detail.deliverSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm */}
      <Dialog open={dialog === "confirm"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{d.detail.confirmTitle}</DialogTitle>
            <DialogDescription>{d.detail.confirmDesc}</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2.5 rounded-lg border bg-background p-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-0.5 size-4 accent-[#88cb34]"
            />
            {d.detail.confirmCheckbox}
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>
              {dict.common.cancel}
            </Button>
            <Button
              disabled={busy || !confirmChecked}
              onClick={() =>
                simpleAction(`/api/deals/${deal.id}/confirm`, {}, d.detail.confirmToast)
              }
            >
              {busy ? dict.common.submitting : d.detail.confirmSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute */}
      <Dialog open={dialog === "dispute"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{d.detail.disputeTitle}</DialogTitle>
            <DialogDescription>{d.detail.disputeDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reason">{d.detail.disputeReason}</Label>
            <Textarea
              id="reason"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={d.detail.disputeReasonPlaceholder}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>
              {dict.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || note.trim().length < 10}
              onClick={() =>
                simpleAction(
                  `/api/deals/${deal.id}/dispute`,
                  { reason: note.trim() },
                  d.detail.disputeToast
                )
              }
            >
              {busy ? dict.common.submitting : d.detail.disputeSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund request */}
      <Dialog open={dialog === "refund"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{d.detail.refundTitle}</DialogTitle>
            <DialogDescription>{d.detail.refundDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rreason">{d.detail.refundReason}</Label>
            <Textarea
              id="rreason"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={d.detail.refundReasonPlaceholder}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>
              {dict.common.cancel}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                simpleAction(
                  `/api/deals/${deal.id}/refund`,
                  { reason: note.trim() },
                  d.detail.refundToast
                )
              }
            >
              {busy ? dict.common.submitting : d.detail.refundSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={dialog === "cancel"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{d.detail.cancelTitle}</DialogTitle>
            <DialogDescription>{d.detail.cancelDesc}</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2.5 rounded-lg border bg-background p-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={cancelChecked}
              onChange={(e) => setCancelChecked(e.target.checked)}
              className="mt-0.5 size-4 accent-[#88cb34]"
            />
            {d.detail.cancelConfirm}
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>
              {dict.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !cancelChecked}
              onClick={() =>
                simpleAction(`/api/deals/${deal.id}/cancel`, {}, d.detail.cancelToast)
              }
            >
              {busy ? dict.common.submitting : d.detail.actionCancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
