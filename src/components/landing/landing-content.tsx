"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Info,
  Landmark,
  Lock,
  Package,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  FileCheck2,
  Handshake,
  CheckCircle2,
  BadgeCheck,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";

const STEP_ICONS = [FileCheck2, UserCheck, Landmark, ShieldCheck, Package, CheckCircle2];

const SECURITY_ICONS = [Lock, ScrollText, ShieldAlert, Handshake];

/**
 * Landing content — the Verify hero design language (badge chip, big
 * title with a green accent word, grid-tinted hero band, spaced CTAs)
 * carrying the escrow story. Everything responds to the bn/en switcher.
 */
export function LandingContent({
  loggedOut,
  authError,
}: {
  loggedOut: boolean;
  authError?: string;
}) {
  const { dict } = useLanguage();
  const hero = dict.landing;

  return (
    <main className="flex-1">
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="bg-grid relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-transparent to-background" />
        <Container className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="outline"
              className="mb-5 gap-1.5 rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary-text"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {hero.badge}
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {hero.titleLead}{" "}
              <span className="text-primary">{hero.titleAccent}</span>{" "}
              {hero.titleTrail}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {hero.subtitle}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  {hero.ctaCreate}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#how-it-works">
                  {hero.ctaHow}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">{hero.noCharges}</p>

            {(loggedOut || authError) && (
              <div
                role="status"
                className={`mx-auto mt-6 flex max-w-xl items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                  authError
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-verified/30 bg-verified/5 text-foreground"
                }`}
              >
                {authError ? (
                  <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Info className="size-4 shrink-0 text-verified-text" aria-hidden="true" />
                )}
                <span>
                  {authError ? hero.heroBannerError : hero.heroBannerLoggedOut}
                </span>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* --------------------------- How it works -------------------------- */}
      <section id="how-it-works" className="border-b bg-card/40">
        <Container className="py-16 sm:py-20">
          <SectionHeading
            eyebrow="Midman Escrow"
            title={hero.howTitle}
            description={hero.howSubtitle}
            align="center"
            className="mx-auto"
          />

          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hero.steps.map((step, index) => {
              const Icon = STEP_ICONS[index % STEP_ICONS.length];
              return (
                <li key={step.title}>
                  <Card className="h-full py-0">
                    <CardContent className="flex h-full flex-col gap-3 px-5 py-5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <Badge
                          variant="outline"
                          className="rounded-full border-primary/30 font-mono text-[11px] text-primary-text"
                        >
                          {String(index + 1).padStart(2, "0")}
                        </Badge>
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        {step.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {step.desc}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {hero.statsDisclaimer}
          </p>
        </Container>
      </section>

      {/* ---------------------------- Security ---------------------------- */}
      <section className="border-b">
        <Container className="py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <SectionHeading
              eyebrow="Protection"
              title={hero.securityTitle}
              description={hero.securitySubtitle}
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-1">
              {hero.securityPoints.map((point, index) => {
                const Icon = SECURITY_ICONS[index % SECURITY_ICONS.length];
                return (
                  <li
                    key={point.title}
                    className="rounded-xl border bg-card p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="size-4 text-primary-text" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {point.title}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {point.desc}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </Container>
      </section>

      {/* ----------------------------- CTA band ---------------------------- */}
      <section>
        <Container className="py-16 sm:py-20">
          <div className="bg-grid relative overflow-hidden rounded-2xl border bg-card px-6 py-12 text-center sm:px-12">
            <BadgeCheck className="mx-auto mb-4 size-10 text-primary" aria-hidden="true" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {hero.ctaTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
              {hero.ctaSubtitle}
            </p>
            <div className="mt-7 flex justify-center">
              <Button size="lg" asChild>
                <Link href="/register">
                  {hero.ctaButton}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
