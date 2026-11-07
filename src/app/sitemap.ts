import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/config/site";

/**
 * Public sitemap. Private dashboards, deals, notifications, settings
 * and the admin panel are deliberately EXCLUDED (see robots.txt) —
 * only the marketing/entry surfaces are indexable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const now = new Date();
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/register`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
