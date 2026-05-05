import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/business-info";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: PUBLIC_SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
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
