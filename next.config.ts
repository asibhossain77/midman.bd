import type { NextConfig } from "next";

/**
 * Midman.bd — Escrow Platform.
 *
 * Security headers applied to every route:
 * - HSTS: forces https for midman.bd once deployed there.
 * - nosniff / frame-deny / referrer-policy: standard hardening for an
 *   app whose cookies are HttpOnly + SameSite=Lax.
 * - Permissions-Policy: the escrow platform needs no powerful browser
 *   features.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root to THIS project (the sandbox parent directory
  // also has a lockfile, which would otherwise make Turbopack infer a
  // wrong root and nest the standalone output).
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
