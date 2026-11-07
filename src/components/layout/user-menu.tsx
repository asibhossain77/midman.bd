"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-context";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  email_verified: boolean;
}

interface SessionState {
  authenticated: boolean;
  user: SessionUser | null;
}

/**
 * Header auth widget. Talks ONLY to /api/auth/session — the single
 * source of truth for "who is browsing Midman.bd".
 */
export function UserMenu() {
  const { dict } = useLanguage();
  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json = (await res.json()) as SessionState;
      setState(json);
    } catch {
      setState({ authenticated: false, user: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled aria-busy="true">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span className="hidden sm:inline">{dict.userMenu.checking}</span>
      </Button>
    );
  }

  if (state?.authenticated && state.user) {
    const initial = state.user.name?.charAt(0).toUpperCase() || "?";
    const isAdmin = state.user.role === "admin";
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="hidden items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-accent sm:inline-flex"
          title={dict.userMenu.dashboard}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
          <span className="max-w-28 truncate text-sm font-medium">
            {state.user.name}
          </span>
        </Link>
        <Button variant="outline" size="icon" className="size-9 sm:hidden" asChild>
          <Link href="/dashboard">
            <span className="text-xs font-semibold">{initial}</span>
            <span className="sr-only">{dict.userMenu.dashboard}</span>
          </Link>
        </Button>
        {isAdmin && (
          <Button variant="outline" size="icon" className="size-9 sm:size-8" asChild>
            <Link href="/admin" title={dict.admin.panel}>
              <ShieldCheck className="size-4 text-primary-text" aria-hidden="true" />
              <span className="sr-only">{dict.admin.panel}</span>
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={loggingOut}
          onClick={async () => {
            setLoggingOut(true);
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/";
          }}
        >
          {loggingOut ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{dict.userMenu.signOut}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Button variant="outline" size="sm" className="px-2.5 sm:px-3" asChild>
        <Link href="/login">
          <span className="sm:hidden">{dict.userMenu.loginShort}</span>
          <span className="hidden sm:inline">{dict.userMenu.login}</span>
        </Link>
      </Button>
      <Button size="sm" className="px-2.5 sm:px-3" asChild>
        <Link href="/register">
          <span className="sm:hidden">{dict.userMenu.registerShort}</span>
          <span className="hidden sm:inline">{dict.userMenu.register}</span>
        </Link>
      </Button>
    </div>
  );
}
