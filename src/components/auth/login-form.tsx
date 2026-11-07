"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, LogIn } from "lucide-react";

import { AuthCardHeader, GoogleIcon } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/lib/i18n/language-context";
import { sanitizeNextPath } from "@/lib/auth/next-path";

/**
 * Login form — email + password (and Google when configured). The API
 * returns stable error_keys that map through the dictionary, so error
 * text follows the active language.
 */
export function LoginForm({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const { dict } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const t = dict.auth;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error_key?: string;
        redirect?: string;
      };
      if (!res.ok || !json.ok) {
        const key = (json.error_key ?? "generic") as keyof typeof t.errors;
        setError(t.errors[key] ?? t.errors.generic);
        setSubmitting(false);
        return;
      }
      const next = sanitizeNextPath(
        new URLSearchParams(window.location.search).get("next")
      );
      router.push(next ?? json.redirect ?? "/dashboard");
    } catch {
      setError(t.errors.generic);
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthCardHeader
        icon={<LogIn className="size-5" aria-hidden="true" />}
        title={t.loginTitle}
        subtitle={t.loginSubtitle}
      />

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
          <Label htmlFor="email">{t.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.password}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <span className="animate-pulse">{dict.common.submitting}</span>
          ) : (
            t.loginSubmit
          )}
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs uppercase text-muted-foreground">
              {t.orDivider}
            </span>
            <Separator className="flex-1" />
          </div>
          <Button variant="outline" className="w-full" asChild>
            <a href="/auth/google">
              <GoogleIcon />
              {t.googleLoginLabel}
            </a>
          </Button>
        </>
      )}

      <div className="mt-6 space-y-2 text-center text-sm">
        <p className="text-muted-foreground">
          {t.noAccount}{" "}
          <Link
            href="/register"
            className="font-semibold text-primary-text hover:underline"
          >
            {t.registerLink}
          </Link>
        </p>
        <p>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            {t.forgotLink}
          </Link>
        </p>
      </div>
    </>
  );
}
