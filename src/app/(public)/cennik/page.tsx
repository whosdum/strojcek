import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ClockIcon } from "lucide-react";
import {
  PUBLIC_SITE_URL,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_E164,
} from "@/lib/business-info";
import { getActiveServices } from "@/server/queries/services";
import { SiteFooter } from "@/components/sections/site-footer";
import { getShopOpeningHours } from "@/server/queries/barbers";

export const revalidate = 1800;

const PAGE_TITLE = "Cenník — Strojček Barbershop Bytča";
const PAGE_DESCRIPTION =
  "Aktuálny cenník služieb barbershopu Strojček v Bytči — pánsky strih, fade strih, úprava brady, hot towel rituál. Ceny v eurách, online rezervácia.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/cennik" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${PUBLIC_SITE_URL}/cennik`,
    type: "website",
    siteName: "Strojček Barbershop",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

interface PricelistService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
}

function PricelistJsonLd({ services }: { services: PricelistService[] }) {
  const offerCatalog = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Cenník — Strojček Barbershop",
    url: `${PUBLIC_SITE_URL}/cennik`,
    itemListElement: services.map((s, i) => ({
      "@type": "Offer",
      position: i + 1,
      url: `${PUBLIC_SITE_URL}/?service=${s.id}`,
      price: s.price,
      priceCurrency: "EUR",
      itemOffered: {
        "@type": "Service",
        name: s.name,
        description: s.description ?? undefined,
        provider: {
          "@type": "BarberShop",
          "@id": `${PUBLIC_SITE_URL}/#localbusiness`,
          name: "Strojček Barbershop",
        },
      },
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
        name: "Cenník",
        item: `${PUBLIC_SITE_URL}/cennik`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerCatalog) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  );
}

export default async function CennikPage() {
  const [servicesRaw, openingHours] = await Promise.all([
    getActiveServices(),
    getShopOpeningHours(),
  ]);

  const services: PricelistService[] = servicesRaw.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    price: Number(s.price),
  }));

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PricelistJsonLd services={services} />

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <Link
          href="/"
          aria-label="Späť na rezerváciu"
          className="mb-5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>

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
            <li className="text-foreground">Cenník</li>
          </ol>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Cenník služieb barbershopu Strojček
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Aktuálne ceny pánskeho strihu, fade strihu, úpravy brady aj hot towel
          rituálu v Bytči. Klikom na položku otvoríte rezerváciu s preddvolenou
          službou — stačí už len vybrať dátum a čas.
        </p>

        <section
          aria-labelledby="rezervacia-cta"
          className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center"
        >
          <h2 id="rezervacia-cta" className="text-base font-semibold tracking-tight">
            Rezervujte si termín online
          </h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Vyberte si službu, dátum a čas — celé to trvá menej ako minútu.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Rezervovať termín
          </Link>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Alebo nám zavolajte:{" "}
            <a
              href={`tel:${SHOP_PHONE_E164}`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {SHOP_PHONE_DISPLAY}
            </a>
          </p>
        </section>

        <section aria-labelledby="cennik-zoznam" className="mt-12">
          <h2
            id="cennik-zoznam"
            className="text-lg font-semibold tracking-tight"
          >
            Zoznam služieb
          </h2>

          {services.length === 0 ? (
            <p className="mt-6 rounded-xl border border-border/40 bg-card/40 p-6 text-center text-[15px] text-muted-foreground">
              Momentálne nie sú dostupné žiadne služby.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40 bg-card/40">
              {services.map((service) => (
                <li key={service.id}>
                  <Link
                    href={`/?service=${service.id}`}
                    className="group flex items-start gap-4 px-4 py-4 transition-colors hover:bg-card/80 sm:px-6 sm:py-5"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[16px] font-semibold leading-tight text-foreground group-hover:text-primary">
                        {service.name}
                      </h3>
                      {service.description && (
                        <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
                          {service.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <ClockIcon className="size-3.5" />
                        {service.durationMinutes} min
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[18px] font-bold text-primary tabular-nums sm:text-[19px]">
                        {service.price.toFixed(0)} €
                      </span>
                      <span className="text-[12px] font-medium text-primary/70 group-hover:text-primary">
                        Rezervovať →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
            Ceny sú konečné, vrátane DPH. Pri rezervácii konkrétneho barbera sa
            môže cena pre niektoré služby mierne líšiť — finálnu sumu vidíte
            v poslednom kroku rezervácie pred potvrdením.
          </p>
        </section>

        <SiteFooter hours={openingHours} />
      </div>
    </div>
  );
}
