import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/business-info";
import {
  SERVICES,
  SITE_CONTENT_LAST_UPDATED,
} from "./(public)/sluzby/_data";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteLastUpdated = new Date(SITE_CONTENT_LAST_UPDATED);

  const serviceEntries: MetadataRoute.Sitemap = SERVICES.map((service) => ({
    url: `${PUBLIC_SITE_URL}/sluzby/${service.slug}`,
    lastModified: new Date(service.lastUpdated),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: PUBLIC_SITE_URL,
      lastModified: siteLastUpdated,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...serviceEntries,
    {
      url: `${PUBLIC_SITE_URL}/cennik`,
      lastModified: siteLastUpdated,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${PUBLIC_SITE_URL}/o-nas`,
      lastModified: siteLastUpdated,
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
