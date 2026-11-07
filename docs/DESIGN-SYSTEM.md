# Midman.bd — Design System

Midman.bd is deliberately the **same product family** as Midman Verify (`verify.midman.bd`): one visual language, two products. This document records the shared design system so both stay in lockstep.

Sources of truth: `src/app/globals.css` (tokens), `src/lib/i18n/*` (typography + language), `src/components/*` (components). The values below were inspected from the running Verify application and reproduced exactly.

---

## 1. Brand palette — the Midman leaf-green identity

Shared across `midman.bd` and `verify.midman.bd`:

| Token | Light | Dark | Notes |
| --- | --- | --- | --- |
| **Brand green** `--primary` | `#88CB34` (oklch 0.769 0.189 131) | `#88CB34` | EXACTLY for primary buttons, badges, active states, highlights, focus rings — both modes |
| **Button ink** `--primary-foreground` | `#1A2E10` | `#1A2E10` | deep leaf charcoal on the brand green (7.4:1 AAA — white on `#88CB34` would be 2:1) |
| **Brand text** `--primary-text` | `#3E7C00` | `#88CB34` | light mode darkens for AA text (5.1:1); dark mode uses the exact green (9:1) |
| Background | `oklch(0.993 0.003 131)` | `oklch(0.17 0.016 131)` | near-white / deep green-charcoal leaf-tinted surfaces |
| Card | `oklch(1 0 0)` | `oklch(0.212 0.017 131)` | |
| Border / input | `oklch(0.915 0.011 131)` | `oklch(1 0 0 / 10–14%)` | |
| Muted | `oklch(0.962 0.008 131)` fg `oklch(0.505 0.02 133)` | `oklch(0.272 0.019 132)` fg `oklch(0.72 0.014 132)` | |
| Accent | `oklch(0.948 0.025 131)` | `oklch(0.315 0.024 132)` | hover washes |
| Destructive | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | reserved — warning accents only |
| Verified / secured | `--verified: #88CB34` (fg `#1A2E10`) | same | "payment secured / completed" states |
| Pending | `oklch(0.68 0.145 62)` | `oklch(0.79 0.15 70)` | review/waiting states |

All non-brand values are OKLCH; hue ≈ 131–136 keeps every surface in the leaf-green family — **no neutral grays anywhere**.

### Hero grid
`.bg-grid` — a subtle 44px grid tinted with `#88CB3414` (light) / `#88CB341f` (dark), used behind hero and CTA bands.

---

## 2. Typography

Exactly the Verify configuration (Next.js `next/font`):

| Font | Role |
| --- | --- |
| **Poppins** 400/500/600/700 | Latin/English UI — geometric brand face |
| **Hind Siliguri** 400/500/600/700 | every Bangla glyph — loaded as a *fallback* in the `--font-sans` stack, so mixed Bengali+English text renders naturally (English in Poppins, Bangla in Hind Siliguri) |
| **Geist Mono** | deal codes (`MB-7F3K2A`), transaction references, ids |

`--font-sans: var(--font-poppins), var(--font-hind-siliguri), ui-sans-serif, …`

### Bangla rendering rules (non-negotiable)
```css
html[lang="bn"] body { line-height: 1.8; }
html[lang="bn"] [class*="tracking-"] { letter-spacing: normal; }
```
Bangla carries overhead matras — taller line height, never letter-spaced. Applied automatically whenever `<html lang="bn">`. The early-lang script paints the right `lang` before first paint (Bangla is the default; no flash for the majority audience).

### Numbers
`src/lib/i18n/numbers.ts` — Bangla digits (০১২৩৪৫৬৭৮৯) + `৳` symbol + en-US grouping when `lang=bn`; dates render through `Intl` in `Asia/Dhaka`.

---

## 3. Layout primitives

| Primitive | Implementation |
| --- | --- |
| Page width | `Container` — `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8` |
| Header | sticky, `h-16`, `border-b`, `bg-background/80 backdrop-blur`; nav appears at `lg` (≥1024px); below lg, navigation rides the user menu + footer (Verify's exact behavior) |
| Footer | `mt-auto border-t bg-card/50` — sticky to viewport bottom, two-column link groups + legal row |
| Auth shell | centered `max-w-md` card (`rounded-xl border bg-card p-6 sm:p-8`) + centered logo above |
| Admin shell | shadcn Sidebar (`collapsible="icon"`, cookie-persisted) + `SidebarInset` + sticky topbar; mobile: off-canvas Sheet with 44px targets |
| Radius | `--radius: 0.625rem` (sm/md/lg/xl derived) |
| Cards | `rounded-xl border bg-card`, consistent `p-4`/`p-6`, `gap-4`/`gap-6` |

## 4. Core components

- **Buttons** — shadcn `Button`: brand green default, outline for secondary, destructive reserved for dispute/ban actions. Height 36px (`sm`), icon buttons `size-9`.
- **Stat cards** — icon + muted label, bold tabular value, muted hint; semantic tones (default/positive/warning/danger). Used on user dashboard and admin overview alike.
- **Status badges** — `DealStatusBadge` maps every escrow status to a semantic tone (muted → pending, brand green → secured, red → disputed, verified → completed).
- **Empty states** — dashed border card, muted icon circle, title + description + optional action.
- **Dialogs** — shadcn Dialog for every deal action (pay/deliver/confirm/dispute/refund/cancel) with explicit confirmations for money-affecting steps.
- **Forms** — `Label` + `Input`/`Textarea`/`Select`; inline field errors below inputs; destructive banners for top-level errors.
- **Toasts** — Radix toast (Toaster) for action feedback.
- **Tables** — `divide-y` cards or bordered tables, mono codes, uppercase muted column headers, horizontal scroll on mobile (`overflow-x-auto`, `min-w-*`).

## 5. Motion

Restrained by contract: hover/focus transitions only (`transition-colors`, subtle sidebar animations). No page animations, no parallax, no decorative motion — fintech sobriety, matching Verify.

## 6. Responsive behavior

- **Desktop (lg+)**: full header nav, 2–4 column stat grids, sidebar admin.
- **Tablet (sm–lg)**: stacked stats, nav rides menus, cards full-width.
- **Mobile (<sm)**: compact header (icon-sized identity + toggles), single-column cards, 44px touch targets, sticky-free simple flows, bottom-sheet-style dialogs (`max-h-[90svh] overflow-y-auto`), horizontal-scroll tables, safe-area-friendly footer.

## 7. Brand mark

`SiteLogo` — rounded leaf-green square with a dark shield + green check (the Verify badge geometry) beside the wordmark **Midman.bd** ("Midman" ink, ".bd" green) and an `ESCROW` micro-tag. Theme-aware via tokens; `SiteMark` is the compact rail variant.

---

## 8. What is intentionally NOT shared

- Codebases, repositories, databases, sessions, cookies (`mb_session` vs `mv_session`), secrets.
- Midman.bd re-implements the shared patterns independently in its own source tree — Verify was used as a **read-only design reference**; nothing was copied from its private data, credentials or production records.
