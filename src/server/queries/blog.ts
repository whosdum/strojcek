import "server-only";
import { Timestamp } from "firebase-admin/firestore";
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
  // Scheduled-publish gate: `publishedAt <= now` keeps future-dated posts
  // hidden from the public index until their release moment, without
  // needing a cron job. The composite index (status ASC, publishedAt DESC)
  // already covers this inequality because the orderBy is on the same
  // field as the inequality filter.
  const now = Timestamp.now();
  const snap = await adminDb
    .collection("blogPosts")
    .where("status", "==", "PUBLISHED")
    .where("publishedAt", "<=", now)
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
  if (options.includeDrafts) return view;
  // Public path: hide DRAFT and hide PUBLISHED posts whose publishedAt is
  // still in the future (scheduled releases).
  if (view.status !== "PUBLISHED") return null;
  if (view.publishedAt && view.publishedAt.getTime() > Date.now()) return null;
  return view;
}

export async function getRelatedBlogPosts(
  currentSlug: string,
  tags: string[],
  limit = 3
): Promise<BlogPostView[]> {
  if (tags.length === 0) return [];
  // Same scheduled-publish gate as the index query. The (status,
  // tags array-contains, publishedAt) composite index supports this
  // inequality because publishedAt is also the orderBy field.
  const now = Timestamp.now();
  const snap = await adminDb
    .collection("blogPosts")
    .where("status", "==", "PUBLISHED")
    .where("tags", "array-contains-any", tags.slice(0, 10))
    .where("publishedAt", "<=", now)
    .orderBy("publishedAt", "desc")
    .limit(limit + 1)
    .get();
  return snap.docs
    .map(mapBlogPost)
    .filter((p) => p.slug !== currentSlug)
    .slice(0, limit);
}
