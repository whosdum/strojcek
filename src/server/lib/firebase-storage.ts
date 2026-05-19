import "server-only";
import { randomUUID } from "node:crypto";
import { adminStorage } from "@/server/lib/firebase-admin";

export const MAX_BLOG_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_BLOG_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedBlogImageType = (typeof ALLOWED_BLOG_IMAGE_TYPES)[number];

const EXT_BY_MIME: Record<AllowedBlogImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAllowedBlogImageType(
  type: string
): type is AllowedBlogImageType {
  return (ALLOWED_BLOG_IMAGE_TYPES as readonly string[]).includes(type);
}

export type BlogImageUploadResult = {
  url: string;
  path: string;
};

/**
 * Upload a blog image to Firebase Storage and return a publicly-fetchable URL.
 *
 * The URL is the standard Firebase Storage download URL format, gated by a
 * per-file random token stored in `firebaseStorageDownloadTokens` metadata.
 * This works under both uniform and fine-grained bucket access modes — no
 * `makePublic()` call required, which would fail on uniform buckets.
 */
export async function uploadBlogImage(params: {
  slug: string;
  kind: "cover" | "inline";
  buffer: Buffer;
  contentType: AllowedBlogImageType;
}): Promise<BlogImageUploadResult> {
  const { slug, kind, buffer, contentType } = params;
  const ext = EXT_BY_MIME[contentType];
  // Timestamp in the filename defeats CDN cache on replace and keeps the
  // path collision-free for inline images uploaded back-to-back.
  const filename = `${kind}-${Date.now()}.${ext}`;
  const path = `blog/${slug}/${filename}`;
  const token = randomUUID();

  const bucket = adminStorage.bucket();
  const file = bucket.file(path);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucket.name
  )}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

  return { url, path };
}

/**
 * Best-effort delete. We swallow not-found errors so cleanup paths
 * (replace cover, delete post) don't fail the surrounding action if the
 * file is already gone or was never uploaded.
 */
export async function deleteBlogImage(path: string): Promise<void> {
  if (!path) return;
  try {
    await adminStorage.bucket().file(path).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn("[deleteBlogImage] non-fatal", path, err);
  }
}

/**
 * Delete every object under `blog/{slug}/`. Called when a post is removed
 * so orphaned inline images don't accumulate in Storage.
 */
export async function deleteBlogFolder(slug: string): Promise<void> {
  if (!slug) return;
  try {
    await adminStorage.bucket().deleteFiles({
      prefix: `blog/${slug}/`,
      force: true,
    });
  } catch (err) {
    console.warn("[deleteBlogFolder] non-fatal", slug, err);
  }
}
