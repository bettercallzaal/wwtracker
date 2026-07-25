import type { MetadataRoute } from "next";

const BASE = "https://wwtracker.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE}/case-study`,
      lastModified: new Date("2026-07-25"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
