import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/business-info";
import {
  SERVICES,
  SITE_CONTENT_LAST_UPDATED,
} from "./(public)/sluzby/_data";
import { getPublishedBlogPosts } from "@/server/queries/blog";

// Revalidate hourly so newly-published blog posts surface to Google quickly
// without a deploy. revalidatePath("/sitemap.xml") in blog actions also
// triggers an immediate refresh, this is the safety net.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteLastUpdated = new Date(SITE_CONTENT_LAST_UPDATED);

  const serviceEntries: MetadataRoute.Sitemap = SERVICES.map((service) => ({
    url: `${PUBLIC_SITE_URL}/sluzby/${service.slug}`,
    lastModified: new Date(service.lastUpdated),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // Pull published blog posts at sitemap-generation time. Drafts are filtered
  // out by the query (where status == PUBLISHED). If Firestore is briefly
  // unavailable we still want the static URLs in the sitemap, so we swallow
  // the error and ship without blog entries rather than 500-ing the whole
  // /sitemap.xml request.
  let blogEntries: MetadataRoute.Sitemap = [];
  let latestBlogUpdate: Date | null = null;
  try {
    const posts = await getPublishedBlogPosts(200);
    blogEntries = posts.map((p) => ({
      url: `${PUBLIC_SITE_URL}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
    if (posts.length > 0) {
      latestBlogUpdate = posts[0].updatedAt;
    }
  } catch (err) {
    console.error("[sitemap] failed to load blog posts", err);
  }

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
      url: `${PUBLIC_SITE_URL}/blog`,
      lastModified: latestBlogUpdate ?? siteLastUpdated,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...blogEntries,
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
