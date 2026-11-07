"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  FilePlus2,
  Info,
  MailCheck,
  ShieldAlert,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount, toBnDigits } from "@/lib/i18n/numbers";
import { cn } from "@/lib/utils";

interface Settings {
  minDealAmount: number;
  maxDealAmount: number;
  feePercent: number;
  requireVerifiedEmail: boolean;
}

/**
 * Create-deal form — the deal sheet both parties will see. Nothing is
 * charged at creation; the other party must already have a Midman.bd
 * account (they receive the invitation by email).
 */
export function CreateDealForm({
  emailVerified,
  settings,
}: {
  emailVerified: boolean;
  settings: Settings;
}) {
  const { dict, lang } = useLanguage();
  const router = useRouter();
  const c = dict.deals.create;
  const t = dict.auth.errors;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountNum = Number(amount.replace(/[^\d]/g, ""));
  const feeAmount = useMemo(() => {
    if (!Number.isFinite(amountNum) || amountNum <= 0) return 0;
    return Math.ceil((amountNum * settings.feePercent) / 100);
  }, [amountNum, settings.feePercent]);

  function err(key: string): string {
    return t[key as keyof typeof t] ?? t.generic;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    setFieldErrors({});

    const local: Record<string, string> = {};
    if (title.trim().length < 3) local.title = err("invalid_input");
    if (!Number.isInteger(amountNum) || amountNum < settings.minDealAmount || amountNum > settings.maxDealAmount) {
      local.amount = err("invalid_amount");
    }
    if (email.trim().toLowerCase() === "") local.email = err("email_invalid");
    if (Object.keys(local).length > 0) {
      setFieldErrors(local);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          terms: terms.trim() || null,
          amount: amountNum,
          counterpartyEmail: email.trim(),
          createdByRole: role,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error_key?: string;
        dealId?: string;
      };
      if (!res.ok || !json.ok) {
        setTopError(err(json.error_key ?? "generic"));
        setSubmitting(false);
        return;
      }
      router.push(`/deals/${json.dealId}?created=1`);
    } catch {
      setTopError(t.generic);
      setSubmitting(false);
    }
  }

  const blocked =
    settings.requireVerifiedEmail && !emailVerified;

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-text">
        {dict.deals.newDeal}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {c.title}
      </h1>
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">
        {c.subtitle}
      </p>

      {blocked && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-pending/40 bg-pending/10 px-4 py-3 text-sm">
          <MailCheck className="size-4 shrink-0 text-pending" aria-hidden="true" />
          <span>{dict.auth.unverifiedBanner}</span>
        </div>
      )}

      {topError && (
        <div
          role="alert"
          className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {topError}
        </div>
      )}

      <Card className="mt-6 py-0">
        <CardContent className="px-5 py-6 sm:px-6">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="title">{c.dealTitle}</Label>
              <Input
                id="title"
                required
                maxLength={120}
                placeholder={c.dealTitlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={Boolean(fieldErrors.title)}
              />
              {fieldErrors.title && (
                <p className="text-xs text-destructive">{fieldErrors.title}</p>
              )}
              <p className="text-xs text-muted-foreground">{c.dealTitleHint}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">{dict.deals.detail.description}</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder={c.descriptionPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="terms">{c.terms}</Label>
              <Textarea
                id="terms"
                rows={4}
                placeholder={c.termsPlaceholder}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{c.termsHint}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="amount">{c.amount}</Label>
                <Input
                  id="amount"
                  inputMode="numeric"
                  required
                  placeholder={c.amountPlaceholder}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.amount)}
                />
                {fieldErrors.amount && (
                  <p className="text-xs text-destructive">{fieldErrors.amount}</p>
                )}
                <p className="text-xs text-muted-foreground">{c.amountHint}</p>
                {amountNum > 0 && settings.feePercent > 0 && (
                  <div className="flex items-start gap-1.5 rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-primary-text" aria-hidden="true" />
                    <span>
                      {dict.common.fee}: {toBnDigits(settings.feePercent, lang)}% ·{" "}
                      {formatAmount(feeAmount, lang, { withSymbol: true })} —{" "}
                      {dict.common.payout}:{" "}
                      {formatAmount(Math.max(0, amountNum - feeAmount), lang)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">{c.yourRole}</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v === "seller" ? "seller" : "buyer")}
                >
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">{c.roleBuyer}</SelectItem>
                    <SelectItem value="seller">{c.roleSeller}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {c.counterpartyEmailHint}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="counterparty">{c.counterpartyEmail}</Label>
              <Input
                id="counterparty"
                type="email"
                inputMode="email"
                required
                placeholder={c.counterpartyEmailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || blocked}
            >
              {submitting ? (
                <span className="animate-pulse">{dict.common.submitting}</span>
              ) : (
                <>
                  <FilePlus2 className="size-4" aria-hidden="true" />
                  {c.submit}
                </>
              )}
            </Button>

            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <ShieldAlert
                className={cn("mt-0.5 size-3.5 shrink-0 text-pending")}
                aria-hidden="true"
              />
              {dict.footer.securityNote}
            </p>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
