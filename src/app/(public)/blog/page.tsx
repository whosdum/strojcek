import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeftIcon,
  ClockIcon,
  PenLineIcon,
  ArrowRightIcon,
  ScissorsIcon,
} from "lucide-react";
import { PUBLIC_SITE_URL } from "@/lib/business-info";
import { getPublishedBlogPosts } from "@/server/queries/blog";
import { SiteFooter } from "@/components/sections/site-footer";
import { getShopOpeningHours } from "@/server/queries/barbers";

export const revalidate = 3600;

const PAGE_TITLE = "Blog — Strojček Barbershop Bytča";
const PAGE_DESCRIPTION =
  "Novinky, tipy a rady z pánskeho barbershopu v Bytči. Ako si vybrať strih, starostlivosť o bradu, zákulisie Strojčeku a nové služby.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${PUBLIC_SITE_URL}/blog`,
    type: "website",
    siteName: "Strojček Barbershop",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bratislava",
  }).format(date);
}

export default async function BlogIndexPage() {
  // Same resilience as sitemap + [slug] page: if Firestore index isn't
  // deployed yet, render the empty-state instead of 500-ing the build.
  const openingHours = await getShopOpeningHours();
  let posts: Awaited<ReturnType<typeof getPublishedBlogPosts>> = [];
  try {
    posts = await getPublishedBlogPosts();
  } catch (err) {
    console.warn("[blog] failed to load posts:", err);
  }

  const [featured, ...rest] = posts;

  const blogLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${PUBLIC_SITE_URL}/blog#blog`,
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${PUBLIC_SITE_URL}/blog`,
    publisher: { "@id": `${PUBLIC_SITE_URL}/#organization` },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.excerpt,
      datePublished: p.publishedAt?.toISOString(),
      dateModified: p.updatedAt.toISOString(),
      url: `${PUBLIC_SITE_URL}/blog/${p.slug}`,
      image: p.coverImageUrl ?? undefined,
    })),
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
    ],
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Hero — soft warm gradient anchored top-right + dot-grid texture so
          the page opens with brand presence without dominating. The big
          h1 with primary accent word becomes the focal point. */}
      <div className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/[0.06] via-background to-background">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 size-[420px] rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative mx-auto max-w-4xl px-4 pb-14 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Späť na rezerváciu
          </Link>

          <div className="mt-12 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-strong">
              <PenLineIcon className="size-3" />
              Blog Strojčeka
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Príbehy z{" "}
              <span className="text-primary-strong">barbershopu</span> v Bytči
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
              Novinky, tipy a postrehy z pánskej úpravy. Píšeme o tom, čo robíme
              za pultom, ako sa staráme o vlasy a bradu klientov a čo nás v
              remesle baví.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        {posts.length === 0 ? (
          <div className="rounded-3xl border border-border/50 bg-card/40 px-8 py-16 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-strong">
              <ScissorsIcon className="size-6" />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight">
              Pripravujeme prvý článok
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Plánujeme tu zdieľať novinky, tipy aj zákulisie barbershopu.
              Sledujte tento priestor — čoskoro pribudne prvý príspevok.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Rezervovať termín
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Featured (newest) post — wider card with side-by-side layout
                on desktop. Falls back to stacked on mobile. */}
            {featured && (
              <article>
                <Link
                  href={`/blog/${featured.slug}`}
                  className="group block overflow-hidden rounded-3xl border border-border/50 bg-card/40 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/[0.04] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="grid gap-0 sm:grid-cols-[1.1fr_1fr]">
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted sm:aspect-auto sm:min-h-[280px]">
                      {featured.coverImageUrl ? (
                        <Image
                          src={featured.coverImageUrl}
                          alt={featured.coverImageAlt ?? featured.title}
                          fill
                          sizes="(min-width: 640px) 480px, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          priority
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
                          <ScissorsIcon className="size-12 text-primary/40" />
                        </div>
                      )}
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-strong shadow-sm backdrop-blur">
                        Najnovší
                      </span>
                    </div>
                    <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                        {featured.publishedAt && (
                          <time
                            dateTime={featured.publishedAt.toISOString()}
                            className="font-medium"
                          >
                            {formatDate(featured.publishedAt)}
                          </time>
                        )}
                        <span aria-hidden className="text-border">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ClockIcon className="size-3" />
                          {featured.readingMinutes} min čítania
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold leading-tight tracking-tight transition-colors group-hover:text-primary-strong sm:text-3xl">
                        {featured.title}
                      </h2>
                      <p className="text-[15px] leading-relaxed text-muted-foreground">
                        {featured.excerpt}
                      </p>
                      {featured.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {featured.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-strong">
                        Čítať článok
                        <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            )}

            {/* Older posts in a 2-column grid on desktop. */}
            {rest.length > 0 && (
              <div>
                <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Staršie články
                </h2>
                <ul className="grid gap-6 sm:grid-cols-2">
                  {rest.map((post) => (
                    <li key={post.slug}>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="group block h-full overflow-hidden rounded-2xl border border-border/50 bg-card/40 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/[0.04] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                          {post.coverImageUrl ? (
                            <Image
                              src={post.coverImageUrl}
                              alt={post.coverImageAlt ?? post.title}
                              fill
                              sizes="(min-width: 640px) 360px, 100vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                              <ScissorsIcon className="size-8 text-primary/40" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-3 p-5">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {post.publishedAt && (
                              <time
                                dateTime={post.publishedAt.toISOString()}
                                className="font-medium"
                              >
                                {formatDate(post.publishedAt)}
                              </time>
                            )}
                            <span aria-hidden className="text-border">
                              ·
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ClockIcon className="size-3" />
                              {post.readingMinutes} min
                            </span>
                          </div>
                          <h3 className="text-lg font-bold leading-tight tracking-tight transition-colors group-hover:text-primary-strong">
                            {post.title}
                          </h3>
                          <p className="line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">
                            {post.excerpt}
                          </p>
                          {post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {post.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <SiteFooter hours={openingHours} />
      </div>
    </div>
  );
}
