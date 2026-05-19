import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { tsToDate } from "@/server/lib/firestore-utils";
import type { BlogPostView } from "@/lib/types";
import type { BlogPostDoc } from "@/server/types/firestore";

function mapBlogPost(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): BlogPostView {
  const d = doc.data() as BlogPostDoc;
  return {
    slug: doc.id,
    title: d.title,
    excerpt: d.excerpt,
    content: d.content,
    coverImageUrl: d.coverImageUrl ?? null,
    coverImagePath: d.coverImagePath ?? null,
    coverImageAlt: d.coverImageAlt ?? null,
    tags: d.tags ?? [],
    status: d.status,
    readingMinutes: d.readingMinutes ?? 1,
    publishedAt: d.publishedAt ? tsToDate(d.publishedAt) : null,
    createdAt: tsToDate(d.createdAt),
    updatedAt: tsToDate(d.updatedAt),
  };
}

export async function getAllBlogPosts(): Promise<BlogPostView[]> {
  const snap = await adminDb
    .collection("blogPosts")
    .orderBy("updatedAt", "desc")
    .limit(200)
    .get();
  return snap.docs.map(mapBlogPost);
}

export async function getPublishedBlogPosts(
  limit = 50
): Promise<BlogPostView[]> {
  const snap = await adminDb
    .collection("blogPosts")
    .where("status", "==", "PUBLISHED")
    .orderBy("publishedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(mapBlogPost);
}

export async function getBlogPostBySlug(
  slug: string,
  options: { includeDrafts?: boolean } = {}
): Promise<BlogPostView | null> {
  const snap = await adminDb.doc(`blogPosts/${slug}`).get();
  if (!snap.exists) return null;
  const view = mapBlogPost(snap as FirebaseFirestore.QueryDocumentSnapshot);
  if (!options.includeDrafts && view.status !== "PUBLISHED") return null;
  return view;
}

export async function getRelatedBlogPosts(
  currentSlug: string,
  tags: string[],
  limit = 3
): Promise<BlogPostView[]> {
  if (tags.length === 0) return [];
  const snap = await adminDb
    .collection("blogPosts")
    .where("status", "==", "PUBLISHED")
    .where("tags", "array-contains-any", tags.slice(0, 10))
    .orderBy("publishedAt", "desc")
    .limit(limit + 1)
    .get();
  return snap.docs
    .map(mapBlogPost)
    .filter((p) => p.slug !== currentSlug)
    .slice(0, limit);
}
