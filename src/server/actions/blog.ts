"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { stripUndefined } from "@/server/lib/firestore-utils";
import { getSession } from "@/server/lib/auth";
import { blogPostInputSchema } from "@/lib/validators";
import { computeReadingMinutes } from "@/lib/reading-time";
import {
  ALLOWED_BLOG_IMAGE_TYPES,
  MAX_BLOG_IMAGE_BYTES,
  deleteBlogFolder,
  deleteBlogImage,
  isAllowedBlogImageType,
  uploadBlogImage,
} from "@/server/lib/firebase-storage";
import { slugify } from "@/lib/slugify";

type ActionResult = { success: boolean; error?: string };

type UploadResult =
  | { success: true; url: string; path: string }
  | { success: false; error: string };

const UNAUTH: ActionResult = {
  success: false,
  error: "Neautorizovaný prístup.",
};

function invalidate(slug?: string) {
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  revalidatePath("/sitemap.xml");
  if (slug) {
    revalidatePath(`/blog/${slug}`);
  }
}

function toDoc(
  data: ReturnType<typeof blogPostInputSchema.parse>,
  readingMinutes: number
) {
  return stripUndefined({
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    content: data.content,
    coverImageUrl: data.coverImageUrl ?? null,
    coverImagePath: data.coverImagePath ?? null,
    coverImageAlt: data.coverImageAlt ?? null,
    tags: data.tags,
    status: data.status,
    readingMinutes,
  });
}

export async function createBlogPost(input: unknown): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const data = blogPostInputSchema.parse(input);
    const readingMinutes = computeReadingMinutes(data.content);
    const ref = adminDb.doc(`blogPosts/${data.slug}`);

    // Transaction guards against slug collision — two admins writing the
    // same slug at the same time would otherwise silently overwrite.
    const result = await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        return { success: false as const, error: "Tento slug už existuje." };
      }
      tx.set(ref, {
        ...toDoc(data, readingMinutes),
        publishedAt: data.status === "PUBLISHED" ? Timestamp.now() : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return { success: true as const };
    });

    if (result.success) invalidate(data.slug);
    return result;
  } catch (e) {
    console.error("[createBlogPost]", e);
    return { success: false, error: "Nastala chyba pri vytváraní článku." };
  }
}

export async function updateBlogPost(
  slug: string,
  input: unknown
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const data = blogPostInputSchema.parse(input);
    const readingMinutes = computeReadingMinutes(data.content);

    // Slug change = move doc. Disallowed for v1 — URL rename should be a
    // dedicated flow with 301 redirects, which we don't have yet.
    if (data.slug !== slug) {
      return {
        success: false,
        error: "Zmena slugu nie je v tomto rozhraní podporovaná.",
      };
    }

    const ref = adminDb.doc(`blogPosts/${slug}`);
    // Capture the previous cover image path so we can clean it up after
    // the transaction commits — only if the new submission carries a
    // different path (replace) or no path at all (cleared).
    let prevCoverPath: string | null = null;
    await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (!existing.exists) {
        throw new Error("not_found");
      }
      const prev = existing.data() as {
        status: string;
        publishedAt: unknown;
        coverImagePath?: string | null;
      };
      prevCoverPath = prev.coverImagePath ?? null;
      // First-time publish: stamp publishedAt. Re-publish: keep original.
      const publishedAt =
        data.status === "PUBLISHED" && prev.status !== "PUBLISHED"
          ? Timestamp.now()
          : (prev.publishedAt ?? null);
      tx.update(ref, {
        ...toDoc(data, readingMinutes),
        publishedAt,
        updatedAt: Timestamp.now(),
      });
    });

    if (prevCoverPath && prevCoverPath !== data.coverImagePath) {
      await deleteBlogImage(prevCoverPath);
    }

    invalidate(slug);
    return { success: true };
  } catch (e) {
    console.error("[updateBlogPost]", e);
    return {
      success: false,
      error: "Nastala chyba pri aktualizácii článku.",
    };
  }
}

export async function deleteBlogPost(slug: string): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    await adminDb.doc(`blogPosts/${slug}`).delete();
    // Wipe the whole blog/{slug}/ folder so inline images uploaded
    // through the editor don't orphan in Storage.
    await deleteBlogFolder(slug);
    invalidate(slug);
    return { success: true };
  } catch (e) {
    console.error("[deleteBlogPost]", e);
    return { success: false, error: "Nastala chyba pri mazaní článku." };
  }
}

export async function toggleBlogPostStatus(
  slug: string
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const ref = adminDb.doc(`blogPosts/${slug}`);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("not_found");
      const data = snap.data() as {
        status: string;
        publishedAt: unknown;
      };
      const nextStatus = data.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      tx.update(ref, {
        status: nextStatus,
        publishedAt:
          nextStatus === "PUBLISHED" && !data.publishedAt
            ? Timestamp.now()
            : data.publishedAt,
        updatedAt: Timestamp.now(),
      });
    });
    invalidate(slug);
    return { success: true };
  } catch (e) {
    console.error("[toggleBlogPostStatus]", e);
    return { success: false, error: "Nastala chyba pri zmene stavu." };
  }
}

/**
 * Upload a single image to Storage and return its public URL.
 *
 * Called from the admin blog form (cover) and the markdown editor
 * (inline). The `slug` argument is sanitised here so unsaved drafts
 * can pass their working slug or a fallback "_drafts" value without
 * letting raw user input land in Storage paths.
 */
export async function uploadBlogImageAction(
  formData: FormData
): Promise<UploadResult> {
  if (!(await getSession())) {
    return { success: false, error: "Neautorizovaný prístup." };
  }

  const file = formData.get("file");
  const rawSlug = formData.get("slug");
  const rawKind = formData.get("kind");

  if (!(file instanceof File)) {
    return { success: false, error: "Chýba súbor." };
  }
  if (file.size === 0) {
    return { success: false, error: "Súbor je prázdny." };
  }
  if (file.size > MAX_BLOG_IMAGE_BYTES) {
    return {
      success: false,
      error: `Obrázok je príliš veľký. Maximálna veľkosť je ${Math.round(
        MAX_BLOG_IMAGE_BYTES / (1024 * 1024)
      )} MB.`,
    };
  }
  if (!isAllowedBlogImageType(file.type)) {
    return {
      success: false,
      error: `Nepodporovaný formát. Povolené: ${ALLOWED_BLOG_IMAGE_TYPES.join(
        ", "
      )}.`,
    };
  }

  const kind = rawKind === "inline" ? "inline" : "cover";
  const slugCandidate =
    typeof rawSlug === "string" ? slugify(rawSlug) : "";
  const slug = slugCandidate.length >= 3 ? slugCandidate : "_drafts";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadBlogImage({
      slug,
      kind,
      buffer,
      contentType: file.type,
    });
    return { success: true, url: result.url, path: result.path };
  } catch (e) {
    console.error("[uploadBlogImageAction]", e);
    return { success: false, error: "Nahranie obrázka zlyhalo." };
  }
}
