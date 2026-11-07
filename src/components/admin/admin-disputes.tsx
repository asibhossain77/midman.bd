"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCheck,
  ExternalLink,
  Handshake,
  Loader2,
  Lock,
  ShieldAlert,
  Undo2,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/shared/empty-state";
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
import { formatDateTime } from "@/lib/i18n/numbers";
import type { DisputeWithDeal } from "@/lib/deals/queries";

/**
 * Dispute management — open disputes freeze their deals completely.
 * Resolutions: refund the buyer, mark completed (seller keeps), or
 * resume the pre-dispute state. Every resolution is audited.
 */
export function AdminDisputes({ disputes }: { disputes: DisputeWithDeal[] }) {
  const { dict, lang } = useLanguage();
  const dp = dict.admin.disputes;
  const router = useRouter();
  const { toast } = useToast();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolve, setResolve] = useState<
    null | { dispute: DisputeWithDeal; resolution: "refund_to_buyer" | "complete" | "resume" }
  >(null);
  const [note, setNote] = useState("");

  async function act() {
    if (!resolve) return;
    setBusyId(resolve.dispute.id);
    try {
      const res = await fetch(`/api/admin/disputes/${resolve.dispute.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: resolve.resolution,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error_key?: string };
      if (res.ok && json.ok) {
        toast({ title: dp.resolutionToast });
        setResolve(null);
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
        {dp.title}
      </h1>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
        {dp.subtitle}
      </p>

      <div className="mt-6">
        {disputes.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={dp.empty}
            description={dict.admin.dashboard.subtitle}
          />
        ) : (
          <ul className="space-y-4">
            {disputes.map((dispute) => (
              <li key={dispute.id}>
                <Card className="border-destructive/30 py-0">
                  <CardContent className="px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {dispute.dealCode}
                          </span>
                          <Badge className="border-transparent bg-destructive text-white">
                            <Lock className="size-3" aria-hidden="true" />
                            {dict.deals.status[dispute.dealStatus]}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-foreground">
                          {dispute.dealTitle}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {dp.colReason}:
                          </span>{" "}
                          {dispute.reason}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {dp.colOpenedBy}: {dispute.openedByName} (
                          {dispute.openedByRole === "buyer"
                            ? dict.deals.roleBuyer
                            : dict.deals.roleSeller}
                          ) · {dp.colOpened}: {formatDateTime(dispute.createdAt, lang)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <Button
                        variant="outline"
                        disabled={busyId === dispute.id}
                        onClick={() => setResolve({ dispute, resolution: "refund_to_buyer" })}
                      >
                        <Undo2 className="size-4" aria-hidden="true" />
                        {dp.refundToBuyer}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busyId === dispute.id}
                        onClick={() => setResolve({ dispute, resolution: "complete" })}
                      >
                        <CheckCheck className="size-4" aria-hidden="true" />
                        {dp.complete}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busyId === dispute.id}
                        onClick={() => setResolve({ dispute, resolution: "resume" })}
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        {dp.resume}
                      </Button>
                      <Button variant="ghost" asChild className="text-muted-foreground">
                        <a href={`/deals/${dispute.dealId}`} target="_blank" rel="noopener noreferrer">
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

      {/* Resolution dialog */}
      <Dialog
        open={resolve !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResolve(null);
            setNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolve?.resolution === "refund_to_buyer"
                ? dp.refundToBuyer
                : resolve?.resolution === "complete"
                  ? dp.complete
                  : dp.resume}
            </DialogTitle>
            <DialogDescription>
              {resolve?.resolution === "refund_to_buyer"
                ? dp.refundNote
                : resolve?.resolution === "resume"
                  ? dict.deals.statusHelp[resolve.dispute.dealStatus]
                  : dict.deals.statusHelp.completed}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {dict.footer.securityNote}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resolution-note">{dp.resolutionNote}</Label>
            <Textarea
              id="resolution-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResolve(null);
                setNote("");
              }}
              disabled={busyId !== null}
            >
              {dict.common.cancel}
            </Button>
            <Button onClick={act} disabled={busyId !== null}>
              {busyId && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {dict.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
