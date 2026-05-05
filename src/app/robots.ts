import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/business-info";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/login"],
      },
    ],
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
