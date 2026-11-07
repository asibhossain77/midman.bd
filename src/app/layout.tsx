import type { Metadata, Viewport } from "next";
import { Geist_Mono, Hind_Siliguri, Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { siteConfig } from "@/lib/config/site";

/**
 * Typography — EXACTLY the Midman Verify configuration:
 *  - Poppins         → Latin/English UI (geometric brand face)
 *  - Hind Siliguri   → every Bangla glyph (loaded as a fallback in the
 *    --font-sans stack: Poppins has no Bengali coverage, so Bangla runs
 *    fall through to Hind Siliguri per-glyph and mixed Bengali+English
 *    text renders naturally — English in Poppins, Bangla in Hind Siliguri)
 *  - Geist Mono     → deal codes, references, ids
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * SEO metadata — Bangla + English alternates, absolute canonical base,
 * Open Graph / Twitter for social sharing (Facebook, Messenger).
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "Bangladesh",
    "escrow",
    "secure payment",
    "midman",
    "safe deal",
    "নিরাপদ লেনদেন",
    "এস্ক্রো",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "bn-BD": "/",
      "en": "/",
      "x-default": "/",
    },
  },
  icons: [
    {
      url: "/favicon.svg",
      type: "image/svg+xml",
    },
  ],
  openGraph: {
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "bn_BD",
    alternateLocale: ["en_US"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#88cb34" },
    { media: "(prefers-color-scheme: dark)", color: "#88cb34" },
  ],
};

/**
 * Applied before paint so returning readers never see the wrong
 * <html lang> (fonts/line-height) — the text itself swaps on hydration.
 * Midman.bd is Bangla-first: no cookie means Bangla.
 */
const earlyLangScript = `(function(){try{var m=document.cookie.match(/(?:^|; )mb_lang=(en|bn)/);document.documentElement.lang=m?(m[1]==="en"?"en":"bn"):"bn";}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={`${poppins.variable} ${hindSiliguri.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlyLangScript }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased bg-background text-foreground">
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <Toaster />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
