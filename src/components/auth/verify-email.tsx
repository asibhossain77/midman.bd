"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MailCheck, ShieldCheck, ShieldX } from "lucide-react";

import { AuthCardHeader } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-context";

type VerifyState = "pending" | "done" | "failed" | "missing";

export function VerifyEmail({ token }: { token: string | null }) {
  const { dict } = useLanguage();
  const t = dict.auth;
  const [state, setState] = useState<VerifyState>(token ? "pending" : "missing");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json()) as { ok?: boolean };
        setState(res.ok && json.ok ? "done" : "failed");
      } catch {
        setState("failed");
      }
    })();
  }, [token]);

  const icon =
    state === "done" ? (
      <ShieldCheck className="size-5" aria-hidden="true" />
    ) : state === "failed" || state === "missing" ? (
      <ShieldX className="size-5" aria-hidden="true" />
    ) : (
      <MailCheck className="size-5" aria-hidden="true" />
    );

  const subtitle =
    state === "pending"
      ? t.verifying
      : state === "done"
        ? t.verified
        : state === "missing"
          ? t.errors.token_missing
          : t.verifyFailed;

  return (
    <>
      <AuthCardHeader icon={icon} title={t.verifyTitle} subtitle={subtitle} />
      <Button className="w-full" asChild>
        <Link href="/dashboard">{dict.userMenu.dashboard}</Link>
      </Button>
    </>
  );
}
