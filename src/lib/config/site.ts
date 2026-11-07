/**
 * Midman.bd — Escrow Platform — Site Configuration
 *
 * Central place for branding, URLs and navigation.
 * No secrets belong in this file — only public, non-sensitive values.
 */

export const siteConfig = {
  name: "Midman.bd",
  shortName: "Midman",
  tagline: "Bangladesh's Trusted Escrow Platform",
  description:
    "Midman.bd holds the buyer's payment in secure escrow until the seller delivers — safe deals between strangers across Bangladesh. Create a deal, pay safely, get paid safely.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://midman.bd",

  /** The verification platform — a sibling Midman product. */
  verifySite: {
    name: "Midman Verify",
    url: process.env.NEXT_PUBLIC_VERIFY_SITE_URL ?? "https://verify.midman.bd",
  },

  links: {
    howItWorks: "/#how-it-works",
    deals: "/deals",
    newDeal: "/deals/new",
    dashboard: "/dashboard",
    notifications: "/notifications",
    activity: "/activity",
    settings: "/settings",
  },

  nav: [
    { title: "Home", href: "/", available: true },
    { title: "How it works", href: "/#how-it-works", available: true },
    { title: "Deals", href: "/deals", available: true },
    { title: "Dashboard", href: "/dashboard", available: true },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
