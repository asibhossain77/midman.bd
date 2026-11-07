"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CircleAlert,
  KeyRound,
  Loader2,
  MailCheck,
  MailX,
  UserRound,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatDate } from "@/lib/i18n/numbers";

interface Props {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    googleLinked: boolean;
    emailVerifiedAt: Date | null;
    createdAt: Date;
  };
  devVerifyUrl: string | null;
}

/**
 * Account settings — profile name, email verification state and
 * password change. The email itself is immutable in this version (it is
 * the identity anchor for deals and Google linking).
 */
export function SettingsContent({ user, devVerifyUrl }: Props) {
  const { dict, lang } = useLanguage();
  const s = dict.settings;
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(user.name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [devResendUrl, setDevResendUrl] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = (await res.json()) as { ok?: boolean };
      if (json.ok) {
        toast({ title: s.savedToast });
        router.refresh();
      } else {
        toast({
          title: dict.common.error,
          description: dict.auth.errors.generic,
          variant: "destructive",
        });
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: dict.common.error,
        description: dict.auth.errors.password_mismatch,
        variant: "destructive",
      });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error_key?: string };
      if (json.ok) {
        toast({ title: s.passwordSavedToast });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
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
      setSavingPassword(false);
    }
  }

  async function resendVerification() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; devVerifyUrl?: string };
      if (json.ok) {
        toast({
          title: dict.auth.registerSuccess,
        });
        if (json.devVerifyUrl) setDevResendUrl(json.devVerifyUrl);
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-text">
        {dict.userMenu.account}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {s.title}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{s.subtitle}</p>

      {/* Account info */}
      <Card className="mt-6 py-0">
        <CardContent className="grid gap-3 px-5 py-5 text-sm sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {s.memberSince}
            </p>
            <p className="mt-1 font-medium text-foreground">
              {formatDate(user.createdAt, lang)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {s.accountRole}
            </p>
            <p className="mt-1 font-medium text-foreground">
              {user.role === "admin" ? s.roleAdmin : s.roleUser}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Google
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
              {user.googleLinked ? (
                <>
                  <BadgeCheck className="size-4 text-primary-text" aria-hidden="true" />
                  {s.googleLinked}
                </>
              ) : (
                s.googleNotLinked
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card className="mt-5 py-0">
        <CardContent className="px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <UserRound className="size-4 text-primary-text" aria-hidden="true" />
            {s.profileTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{s.profileDesc}</p>
          <form onSubmit={saveProfile} className="mt-4 max-w-sm space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">{s.nameLabel}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={savingProfile || name.trim().length < 2}>
              {savingProfile && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {dict.common.save}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email */}
      <Card className="mt-5 py-0">
        <CardContent className="px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MailCheck className="size-4 text-primary-text" aria-hidden="true" />
            {s.emailTitle}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-foreground">{user.email}</span>
            {user.emailVerifiedAt ? (
              <Badge className="border-transparent bg-verified text-verified-foreground">
                <BadgeCheck className="size-3" aria-hidden="true" />
                {s.emailVerified}
              </Badge>
            ) : (
              <Badge className="border-transparent bg-pending text-pending-foreground">
                <MailX className="size-3" aria-hidden="true" />
                {s.emailNotVerified}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{s.emailDesc}</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.emailReadOnly}</p>
          {!user.emailVerifiedAt && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={resendVerification}
                disabled={resending}
              >
                {resending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {s.verifyNow}
              </Button>
              {(devResendUrl || devVerifyUrl) && (
                <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs break-all">
                  <p className="mb-1 font-medium text-primary-text">
                    {dict.auth.devLinkNote}
                  </p>
                  <a className="underline" href={devResendUrl ?? devVerifyUrl ?? "#"}>
                    {devResendUrl ?? devVerifyUrl}
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="mt-5 py-0">
        <CardContent className="px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <KeyRound className="size-4 text-primary-text" aria-hidden="true" />
            {s.passwordTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{s.passwordDesc}</p>
          <form onSubmit={changePassword} className="mt-4 max-w-sm space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="current">{s.currentPassword}</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new">{dict.auth.newPassword}</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">{dict.auth.passwordHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{dict.auth.confirmPassword}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={
                savingPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword ||
                !currentPassword
              }
            >
              {savingPassword && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {dict.common.save}
            </Button>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <CircleAlert className="size-3.5" aria-hidden="true" />
                {dict.auth.errors.password_mismatch}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
