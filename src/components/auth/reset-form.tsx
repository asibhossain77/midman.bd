"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, CircleAlert } from "lucide-react";

import { AuthCardHeader } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n/language-context";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const { dict } = useLanguage();
  const t = dict.auth;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t.errors.password_short);
      return;
    }
    if (password !== confirm) {
      setError(t.errors.password_mismatch);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = (await res.json()) as { ok?: boolean; error_key?: string };
      if (res.ok && json.ok) {
        setDone(true);
      } else {
        setError(
          t.errors[(json.error_key ?? "weak_token") as keyof typeof t.errors] ??
            t.errors.generic
        );
      }
    } catch {
      setError(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <AuthCardHeader
          icon={<ShieldCheck className="size-5" aria-hidden="true" />}
          title={t.resetTitle}
          subtitle={t.resetDone}
        />
        <Button className="w-full" asChild>
          <Link href="/login">{t.loginLink}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthCardHeader
        icon={<ShieldCheck className="size-5" aria-hidden="true" />}
        title={t.resetTitle}
        subtitle={t.resetSubtitle}
      />
      {!token && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {t.errors.token_missing}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.newPassword}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder={t.newPasswordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t.confirmPassword}</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder={t.confirmPasswordPlaceholder}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || !token}
        >
          {submitting ? (
            <span className="animate-pulse">{dict.common.submitting}</span>
          ) : (
            t.resetSubmit
          )}
        </Button>
      </form>
    </>
  );
}
