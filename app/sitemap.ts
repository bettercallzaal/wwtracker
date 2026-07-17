import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://wwtracker.vercel.app",
      lastModified: "2026-07-16",
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://wwtracker.vercel.app/llms.txt",
      lastModified: "2026-07-16",
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
