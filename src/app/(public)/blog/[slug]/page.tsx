import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import {
  ArrowLeftIcon,
  ClockIcon,
  CalendarIcon,
  ArrowRightIcon,
  ScissorsIcon,
  EyeOffIcon,
} from "lucide-react";
import { PUBLIC_SITE_URL } from "@/lib/business-info";
import {
  getBlogPostBySlug,
  getRelatedBlogPosts,
  getPublishedBlogPosts,
} from "@/server/queries/blog";
import { getSession } from "@/server/lib/auth";
import { SiteFooter } from "@/components/sections/site-footer";
import { getShopOpeningHours } from "@/server/queries/barbers";
import { MarkdownRenderer } from "@/components/blog/markdown-renderer";

async function tryGetSession() {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Pre-render published posts that already exist at build time so first
  // visit is fully cached. New posts created post-deploy still render
  // (dynamicParams=true) and ISR them on first request.
  //
  // Build resilience: if Firestore is unreachable or the composite index
  // (status, publishedAt) hasn't been deployed yet, we don't want the whole
  // build to fail — return [] and let ISR populate routes on demand.
  try {
    const posts = await getPublishedBlogPosts(50);
    return posts.map((p) => ({ slug: p.slug }));
  } catch (err) {
    console.warn("[blog/[slug]] generateStaticParams skipped:", err);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const session = await tryGetSession();
  const post = await getBlogPostBySlug(slug, { includeDrafts: !!session });
  if (!post) return {};

  const title = `${post.title} | Strojček Barbershop Bytča`;

  return {
    title: { absolute: title },
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    // Drafts are admin-only previews — never indexed even though the
    // article URL is technically accessible to a logged-in admin.
    robots:
      post.status === "DRAFT"
        ? { index: false, follow: false }
        : { index: true, follow: true },
    openGraph: {
      title,
      description: post.excerpt,
      url: `${PUBLIC_SITE_URL}/blog/${slug}`,
      type: "article",
      siteName: "Strojček Barbershop",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      tags: post.tags,
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.excerpt,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bratislava",
  }).format(date);
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Bratislava",
  }).format(date);
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Admin preview path: a logged-in admin can open a DRAFT article via the
  // same /blog/{slug} URL. We opt this request out of ISR caching so the
  // public render (which 404s drafts) stays cached separately by Next.js,
  // and pass `includeDrafts` so the query returns the doc.
  const session = await tryGetSession();
  if (session) noStore();

  const post = await getBlogPostBySlug(slug, { includeDrafts: !!session });
  if (!post) notFound();
  const isDraftPreview = post.status === "DRAFT";

  const [related, openingHours] = await Promise.all([
    getRelatedBlogPosts(post.slug, post.tags, 3).catch(() => []),
    getShopOpeningHours(),
  ]);

  const url = `${PUBLIC_SITE_URL}/blog/${slug}`;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ?? `${PUBLIC_SITE_URL}/logo-square.jpg`,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@id": `${PUBLIC_SITE_URL}/#organization` },
    publisher: { "@id": `${PUBLIC_SITE_URL}/#organization` },
    keywords: post.tags.join(", "),
    wordCount: post.content.trim().split(/\s+/).length,
    inLanguage: "sk-SK",
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Domov",
        item: PUBLIC_SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${PUBLIC_SITE_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: url,
      },
    ],
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {isDraftPreview && (
        <div className="border-b border-amber-500/30 bg-amber-50">
          <div className="mx-auto flex max-w-3xl items-start gap-2.5 px-4 py-2.5 text-[13px] text-amber-900 sm:px-6">
            <EyeOffIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>Náhľad konceptu</strong> — tento článok je v stave
              „Koncept“ a verejnosť ho nevidí. Po publikovaní v admin paneli
              sa zjaví na /blog a v sitemap.
            </p>
          </div>
        </div>
      )}

      {/* Article hero — subtle warm gradient on top edge anchors the page
          and complements the cover image. Title sits on top of plain
          background for max legibility. */}
      <div className="relative border-b border-border/40 bg-gradient-to-b from-primary/[0.04] to-background">
        <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Späť na blog
          </Link>

          <nav
            aria-label="Breadcrumb"
            className="mt-8 text-[12px] text-muted-foreground"
          >
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Domov
                </Link>
              </li>
              <li aria-hidden="true" className="text-border">
                /
              </li>
              <li>
                <Link href="/blog" className="hover:text-foreground">
                  Blog
                </Link>
              </li>
              <li aria-hidden="true" className="text-border">
                /
              </li>
              <li className="text-foreground">{post.title}</li>
            </ol>
          </nav>

          <header className="mt-6">
            {post.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {post.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-strong"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-[42px] sm:leading-[1.05]">
              {post.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
              {post.publishedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5" />
                  <time dateTime={post.publishedAt.toISOString()}>
                    {formatDate(post.publishedAt)}
                  </time>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="size-3.5" />
                {post.readingMinutes} min čítania
              </span>
            </div>
            {post.excerpt && (
              <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
                {post.excerpt}
              </p>
            )}
          </header>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        {post.coverImageUrl && (
          <div className="relative -mt-6 mb-10 aspect-[16/9] w-full overflow-hidden rounded-3xl border border-border/40 bg-muted shadow-lg shadow-primary/[0.03]">
            <Image
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? post.title}
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}

        <article className="mt-2">
          <MarkdownRenderer content={post.content} />
        </article>

        {/* In-article CTA — subtle so it doesn't interrupt reading flow. */}
        <section className="mt-16 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent p-7 sm:p-9">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-strong sm:flex">
                <ScissorsIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Hľadáte termín v Bytči?
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                  Pánsky strih, fade alebo úprava brady — rezervujte si termín
                  online za 60 sekúnd.
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Rezervovať
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Čítajte ďalej
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group block h-full overflow-hidden rounded-2xl border border-border/50 bg-card/40 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/[0.04]"
                >
                  {r.coverImageUrl && (
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                      <Image
                        src={r.coverImageUrl}
                        alt={r.coverImageAlt ?? r.title}
                        fill
                        sizes="(min-width: 640px) 240px, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 p-4">
                    <p className="text-[14px] font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary-strong">
                      {r.title}
                    </p>
                    <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                      {r.excerpt}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {r.publishedAt ? formatDateShort(r.publishedAt) : ""} ·{" "}
                      {r.readingMinutes} min
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <SiteFooter hours={openingHours} className="mt-16 rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8" />
      </div>
    </div>
  );
}
