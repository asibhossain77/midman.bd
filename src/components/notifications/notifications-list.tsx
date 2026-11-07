"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BellOff, BellRing, Loader2 } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, formatDateTime } from "@/lib/i18n/numbers";
import { cn } from "@/lib/utils";
import type { NotificationRow } from "@/lib/notifications";

/** Render a notification's localized text from type + params. */
function NotifText({
  row,
  dict,
  lang,
}: {
  row: NotificationRow;
  dict: ReturnType<typeof useLanguage>["dict"];
  lang: "bn" | "en";
}) {
  const template =
    dict.notifTexts[row.type as keyof typeof dict.notifTexts] ?? row.type;
  const text = template
    .replace("{actor}", row.params?.actor ?? "")
    .replace("{title}", row.params?.title ?? "")
    .replace(
      "{amount}",
      row.params?.amount !== undefined
        ? formatAmount(row.params.amount, lang)
        : ""
    );
  return <>{text}</>;
}

export function NotificationsList({ items }: { items: NotificationRow[] }) {
  const { dict, lang } = useLanguage();
  const d = dict.notifications;
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const unread = useMemo(
    () => items.filter((i) => !i.readAt).length,
    [items]
  );

  async function markAll() {
    setBusy(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-text">
            {dict.userMenu.notifications}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {d.title}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">{d.subtitle}</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={markAll} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {d.markAll}
          </Button>
        )}
      </div>

      <div className="mt-6">
        {items.length === 0 ? (
          <Card className="py-0">
            <CardContent className="flex flex-col items-center px-6 py-16 text-center">
              <BellOff className="size-8 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {d.emptyTitle}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{d.emptyDesc}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {items.map((row) => {
              const inner = (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 transition-colors",
                    !row.readAt && "border-primary/30 bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      row.readAt ? "bg-muted-foreground/40" : "bg-primary"
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-foreground">
                      <NotifText row={row} dict={dict} lang={lang} />
                      {!row.readAt && (
                        <Badge_New label={d.unreadBadge} />
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt, lang)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={row.id}>
                  {row.dealId ? (
                    <Link href={`/deals/${row.dealId}`} className="block rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Container>
  );
}

function Badge_New({ label }: { label: string }) {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
      {label}
    </span>
  );
}

export function UnreadBadge() {
  return <BellRing className="hidden" aria-hidden="true" />;
}
