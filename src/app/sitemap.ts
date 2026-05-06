import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/business-info";
import { ALL_SERVICE_SLUGS } from "./(public)/sluzby/_data";

export default function sitemap(): MetadataRoute.Sitemap {
  const serviceEntries: MetadataRoute.Sitemap = ALL_SERVICE_SLUGS.map(
    (slug) => ({
      url: `${PUBLIC_SITE_URL}/sluzby/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    })
  );

  return [
    {
      url: PUBLIC_SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...serviceEntries,
    {
      url: `${PUBLIC_SITE_URL}/o-nas`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${PUBLIC_SITE_URL}/vop`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${PUBLIC_SITE_URL}/ochrana-udajov`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
