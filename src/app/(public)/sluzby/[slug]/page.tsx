import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ClockIcon } from "lucide-react";
import { notFound } from "next/navigation";
import {
  SERVICES,
  getServiceBySlug,
  type ServiceContent,
} from "../_data";
import { PUBLIC_SITE_URL } from "@/lib/business-info";

export const revalidate = 86400;

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) return {};

  return {
    title: `${service.name} v Bytči`,
    description: service.metaDescription,
    alternates: { canonical: `/sluzby/${slug}` },
    openGraph: {
      title: `${service.name} v Bytči | Strojček Barbershop`,
      description: service.metaDescription,
      url: `${PUBLIC_SITE_URL}/sluzby/${slug}`,
      type: "website",
    },
  };
}

function ServiceJsonLd({ service }: { service: ServiceContent }) {
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.intro,
    serviceType: service.name,
    provider: {
      "@type": "BarberShop",
      "@id": `${PUBLIC_SITE_URL}/#localbusiness`,
      name: "Strojček Barbershop",
      url: PUBLIC_SITE_URL,
    },
    areaServed: [
      { "@type": "City", name: "Bytča" },
      { "@type": "City", name: "Predmier" },
      { "@type": "City", name: "Považská Bystrica" },
      { "@type": "City", name: "Žilina" },
    ],
    url: `${PUBLIC_SITE_URL}/sluzby/${service.slug}`,
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
        name: "Služby",
        item: `${PUBLIC_SITE_URL}/sluzby/${service.slug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: service.name,
        item: `${PUBLIC_SITE_URL}/sluzby/${service.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  );
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) notFound();

  const related = service.relatedSlugs
    .map((s) => getServiceBySlug(s))
    .filter((s): s is ServiceContent => Boolean(s));

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ServiceJsonLd service={service} />

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" />
          Späť na rezerváciu
        </Link>

        {/* Breadcrumb (visual) */}
        <nav
          aria-label="Breadcrumb"
          className="mb-3 text-[12px] text-muted-foreground"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-foreground">
                Domov
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground">{service.name}</li>
          </ol>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {service.name} v Bytči
        </h1>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <ClockIcon className="size-3.5" />
          Trvanie {service.durationLabel}
        </p>

        <p className="mt-6 text-[15px] leading-relaxed text-foreground/90">
          {service.intro}
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">
            Pre koho je vhodný
          </h2>
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-muted-foreground">
            {service.forWhom.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 block size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Ako prebieha</h2>
          <ol className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
            {service.howItWorks.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12px] font-bold text-primary"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 rounded-2xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-base font-semibold tracking-tight">
            Prečo Strojček
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {service.whyUs}
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <h2 className="text-base font-semibold tracking-tight">
            Rezervujte si termín online
          </h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Vyberte si službu, dátum a čas — celé to trvá menej ako minútu.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Rezervovať {service.name.toLowerCase()}
          </Link>
        </section>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-base font-semibold tracking-tight">
              Pozri tiež
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/sluzby/${r.slug}`}
                  className="rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:border-border/80 hover:bg-card/60"
                >
                  <p className="text-[14px] font-semibold text-foreground">
                    {r.name}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {r.durationLabel}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-12 border-t border-border/40 pt-6 text-center text-[13px] text-muted-foreground">
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/vop"
              prefetch={false}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              Obchodné podmienky
            </Link>
            <span className="text-border">|</span>
            <Link
              href="/ochrana-udajov"
              prefetch={false}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              Ochrana osobných údajov
            </Link>
          </div>
          <p className="mt-2">
            © {new Date().getFullYear()} STROJČEK s.r.o.
          </p>
        </footer>
      </div>
    </div>
  );
}
