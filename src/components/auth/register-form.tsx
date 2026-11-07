"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, UserRoundPlus } from "lucide-react";

import { AuthCardHeader, GoogleIcon } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/lib/i18n/language-context";

/**
 * Registration form. On success the session is set immediately (the
 * dashboard shows the unverified-email banner until the token is
 * consumed) and the user lands on /dashboard.
 */
export function RegisterForm({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const { dict } = useLanguage();
  const router = useRouter();
  const t = dict.auth;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function err(key: string): string {
    return (
      t.errors[key as keyof typeof t.errors] ?? t.errors.generic
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const local: Record<string, string> = {};
    if (name.trim().length < 2) local.name = err("name_short");
    if (password.length < 8) local.password = err("password_short");
    if (password !== confirm) local.confirm = err("password_mismatch");
    if (Object.keys(local).length > 0) {
      setFieldErrors(local);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error_key?: string;
        fields?: Record<string, string>;
      };
      if (!res.ok || !json.ok) {
        if (json.fields) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(json.fields).map(([k, v]) => [k, err(v)])
            )
          );
        }
        setError(err(json.error_key ?? "generic"));
        setSubmitting(false);
        return;
      }
      router.push("/dashboard?welcome=1");
    } catch {
      setError(t.errors.generic);
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthCardHeader
        icon={<UserRoundPlus className="size-5" aria-hidden="true" />}
        title={t.registerTitle}
        subtitle={t.registerSubtitle}
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
          <Label htmlFor="name">{t.name}</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>
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
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.password}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder={t.newPasswordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password && (
            <p className="text-xs text-destructive">{fieldErrors.password}</p>
          )}
          <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t.confirmPassword}</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder={t.confirmPasswordPlaceholder}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(fieldErrors.confirm)}
          />
          {fieldErrors.confirm && (
            <p className="text-xs text-destructive">{fieldErrors.confirm}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <span className="animate-pulse">{dict.common.submitting}</span>
          ) : (
            t.registerSubmit
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t.haveAccount}{" "}
        <Link
          href="/login"
          className="font-semibold text-primary-text hover:underline"
        >
          {t.loginLink}
        </Link>
      </p>
    </>
  );
}
