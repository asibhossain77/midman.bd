"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, MailCheck } from "lucide-react";

import { AuthCardHeader } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n/language-context";

export function ForgotPasswordForm() {
  const { dict } = useLanguage();
  const t = dict.auth;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { ok?: boolean; devResetUrl?: string };
      if (json.ok) {
        setSent(true);
        setDevUrl(json.devResetUrl ?? null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <>
        <AuthCardHeader
          icon={<MailCheck className="size-5" aria-hidden="true" />}
          title={t.forgotTitle}
          subtitle={t.resetSent}
        />
        {devUrl && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs break-all">
            <p className="mb-1 font-medium text-primary-text">
              {t.devLinkNote}
            </p>
            <a className="underline" href={devUrl}>
              {devUrl}
            </a>
          </div>
        )}
        <p className="mt-5 text-center text-sm">
          <Link
            href="/login"
            className="font-semibold text-primary-text hover:underline"
          >
            {t.backToLogin}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthCardHeader
        icon={<KeyRound className="size-5" aria-hidden="true" />}
        title={t.forgotTitle}
        subtitle={t.forgotSubtitle}
      />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.email}</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <span className="animate-pulse">{dict.common.submitting}</span>
          ) : (
            t.forgotSubmit
          )}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          {t.backToLogin}
        </Link>
      </p>
    </>
  );
}
