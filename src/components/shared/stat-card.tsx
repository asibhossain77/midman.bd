"use client";

import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/i18n/numbers";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { DealStatus } from "@/lib/deals/status";

/* ------------------------------------------------------------------ */
/* Stat card — the Verify dashboard's stat-card language               */
/* ------------------------------------------------------------------ */

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  return (
    <Card className="py-0">
      <CardContent className="px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "size-4",
              tone === "positive" && "text-primary-text",
              tone === "warning" && "text-pending",
              tone === "danger" && "text-destructive",
              tone === "default" && "text-muted-foreground"
            )}
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Deal status badge — semantic tones over the shared badge primitive   */
/* ------------------------------------------------------------------ */

export function DealStatusBadge({
  status,
  dict,
  className,
}: {
  status: DealStatus;
  dict: Dictionary;
  className?: string;
}) {
  const label = dict.deals.status[status];
  const styles: Record<DealStatus, string> = {
    pending_acceptance: "bg-muted text-muted-foreground",
    accepted: "bg-secondary text-secondary-foreground",
    payment_submitted: "bg-pending text-pending-foreground",
    secured: "bg-primary text-primary-foreground",
    delivered: "bg-primary/15 text-primary-text",
    completed: "bg-verified text-verified-foreground",
    disputed: "bg-destructive text-white",
    refund_requested: "bg-pending/20 text-pending dark:text-pending",
    refunded: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <Badge className={cn("gap-1 border-transparent font-medium", styles[status], className)}>
      {status === "secured" && (
        <ShieldCheck className="size-3" aria-hidden="true" />
      )}
      {label}
    </Badge>
  );
}
