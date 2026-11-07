"use client";

import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SiteLogo } from "@/components/branding/site-logo";
import { siteConfig } from "@/lib/config/site";
import { useLanguage } from "@/lib/i18n/language-context";

export function SiteFooter() {
  const { dict } = useLanguage();

  return (
    <footer className="mt-auto border-t bg-card/50">
      <Container>
        <div className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-3">
            <SiteLogo />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {siteConfig.description}
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="mb-3 font-semibold text-foreground">
                {dict.footer.platformColumn}
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/" className="hover:text-foreground">
                    {dict.footer.home}
                  </Link>
                </li>
                <li>
                  <Link href="/deals" className="hover:text-foreground">
                    {dict.footer.deals}
                  </Link>
                </li>
                <li>
                  <Link href="/#how-it-works" className="hover:text-foreground">
                    {dict.footer.howItWorks}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 font-semibold text-foreground">
                {dict.footer.midmanFamily}
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <a
                    href={siteConfig.verifySite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {siteConfig.verifySite.name}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
                <li className="leading-relaxed">{dict.footer.familyNote}</li>
                <li className="flex items-start gap-2 leading-relaxed">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary-text" aria-hidden="true" />
                  {dict.footer.securityNote}
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name} ·{" "}
            {dict.footer.madeFor}
          </p>
          <p>{dict.footer.aMidmanPlatform}</p>
        </div>
      </Container>
    </footer>
  );
}
