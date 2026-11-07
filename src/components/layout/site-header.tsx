"use client";

import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SiteLogo } from "@/components/branding/site-logo";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageToggle } from "@/components/theme/language-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { useLanguage } from "@/lib/i18n/language-context";

/**
 * Site header — the Verify header pattern: sticky, blurred brand bar,
 * desktop nav at lg, compact controls. Mobile navigation rides on the
 * user menu + footer exactly like Verify.
 */
export function SiteHeader() {
  const { dict } = useLanguage();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container>
        <div className="flex h-16 items-center justify-between gap-2 sm:gap-3">
          <Link
            href="/"
            className="rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Midman.bd home"
          >
            <SiteLogo />
          </Link>

          <nav aria-label="Main navigation" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {siteConfig.nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {dict.nav[item.href as keyof typeof dict.nav] ?? item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button size="sm" className="hidden lg:inline-flex" asChild>
              <Link href="/deals/new">
                <FilePlus2 className="size-4" aria-hidden="true" />
                {dict.userMenu.newDeal}
              </Link>
            </Button>
            <LanguageToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </Container>
    </header>
  );
}
