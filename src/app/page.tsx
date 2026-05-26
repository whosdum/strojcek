export const revalidate = 1800;

import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { getActiveServices } from "@/server/queries/services";
import {
  getActiveBarbersWithServices,
  getShopOpeningHours,
} from "@/server/queries/barbers";
import {
  getAvailabilityBundle,
  type AvailabilityBundle,
} from "@/server/queries/slots";
import { getShopSettings } from "@/server/queries/settings";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { BookingShell } from "@/components/booking/booking-shell";
import { StructuredData } from "@/components/structured-data";

const DEFAULT_BOOKING_HORIZON_WEEKS = 3;
import Image from "next/image";
import Link from "next/link";
import { PhoneIcon } from "lucide-react";
import { SHOP_PHONE_E164, SHOP_PHONE_DISPLAY } from "@/lib/business-info";
import { ServicesSection } from "@/components/sections/services-section";
import { ReviewsSection } from "@/components/sections/reviews-section";
import { FaqSection, FaqJsonLd } from "@/components/sections/faq-section";
import { SiteFooter } from "@/components/sections/site-footer";
import { BookingCta } from "@/components/sections/booking-cta";
import { InstagramEmbed } from "@/components/instagram-embed";
import { InstagramIcon } from "@/components/icons/instagram-icon";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ service?: string | string[] }>;
}) {
  const [services, barbers, openingHours, sp] = await Promise.all([
    getActiveServices(),
    getActiveBarbersWithServices(),
    getShopOpeningHours(),
    searchParams ?? Promise.resolve(undefined),
  ]);

  const serializedServices = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    price: s.price.toString(),
  }));

  const requestedServiceId = Array.isArray(sp?.service)
    ? sp?.service[0]
    : sp?.service;
  const initialServiceId = requestedServiceId
    ? services.find((s) => s.id === requestedServiceId)?.id ?? null
    : null;

  // SSR prefetch for the deep-link path (?service=X). When the chosen
  // service maps to exactly one barber, fetch the full availability bundle
  // here so the wizard's calendar AND every date's slot list are populated
  // on first paint — no client round-trip, no "Načítavam rozvrh..." spinner.
  // noStore() opts this fetch out of ISR; the rest of the page still
  // benefits from the file-level revalidate, but the slot map needs to be
  // fresh because someone else may have just booked a slot.
  let initialAvailability: AvailabilityBundle | null = null;
  let initialAvailabilityBarberId: string | null = null;
  if (initialServiceId) {
    const candidates = barbers.filter((b) =>
      b.serviceIds.includes(initialServiceId)
    );
    if (candidates.length === 1) {
      noStore();
      const barberId = candidates[0].id;
      const horizonWeeks =
        candidates[0].bookingHorizonWeeks ?? DEFAULT_BOOKING_HORIZON_WEEKS;
      try {
        const settings = await getShopSettings();
        initialAvailability = await getAvailabilityBundle(
          barberId,
          initialServiceId,
          horizonWeeks,
          settings.slotIntervalMinutes
        );
        initialAvailabilityBarberId = barberId;
      } catch (err) {
        // Non-fatal — wizard will fall back to client fetch on mount.
        console.error("[home-page] availability prefetch failed", err);
      }
    }
  }

  return (
    <BookingShell>
      <StructuredData
        openingHours={openingHours}
        services={services.map((s) => ({
          name: s.name,
          description: s.description ?? "",
          price: Number(s.price),
        }))}
      />
      <header className="mb-5 flex flex-col items-center text-center sm:mb-6">
        <Image
          src="/logo.jpg"
          alt="Bytča barber Strojček — pánsky barbershop v Bytči"
          width={140}
          height={76}
          sizes="140px"
          quality={75}
          className="rounded-xl shadow-lg shadow-black/20"
          priority
          fetchPriority="high"
        />
        <h1 className="mt-3 text-xl font-bold tracking-tight text-primary-strong sm:text-2xl">
          Strojček — pánsky barbershop v Bytči
        </h1>
        <p className="mt-1.5 text-[13px] font-medium text-muted-foreground sm:text-sm">
          Bytča barber pre klasický pánsky strih, fade a úpravu brady.
        </p>
      </header>

      <main>
        {/* Booking form is wrapped in a single bounded section so it's
            visually obvious where the form begins and ends. The header
            strip (announcement + chevron) is now the card's top, the
            wizard fills the body, and the rounded bottom edge marks the
            close — replaces the previous two-cards-stacked layout. */}
        <section
          aria-labelledby="rezervacia-heading"
          className="overflow-hidden rounded-2xl border-2 border-primary/40 bg-card shadow-lg shadow-primary/5"
        >
          <div className="border-b border-border/40 bg-primary/[0.08] px-4 py-3.5 text-center sm:px-5 sm:py-4">
            <h2
              id="rezervacia-heading"
              className="text-[16px] font-bold leading-snug tracking-tight text-foreground sm:text-[17px]"
            >
              Objednajte sa online
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-foreground/80 sm:text-[13px]">
              Len za 60 sekúnd
            </p>
          </div>
          {/* Body padding kept minimal on mobile so the booking calendar's
              7-day grid fits within the outer card without the last column
              ("ne") overflowing — 12px outer + 16px section card = 28px
              total side margin, which leaves enough room for the 7 cells. */}
          <div className="px-3 py-4 sm:p-5">
            <BookingWizard
              services={serializedServices}
              barbers={barbers}
              initialServiceId={initialServiceId}
              initialAvailability={initialAvailability}
              initialAvailabilityBarberId={initialAvailabilityBarberId}
            />
          </div>
          <div
            aria-hidden="true"
            className="border-t border-border/40 bg-muted/30 px-4 py-2.5 text-center text-[12px] text-muted-foreground sm:px-5"
          >
            Koniec rezervačného formulára
          </div>
        </section>

        {/* Phone fallback CTA — placed directly below the booking form so
            users who'd rather call (often older customers, or anyone
            unsure about the online flow) don't have to scroll all the way
            to the footer to find the number. Margin is generous so it
            visually detaches from the form above (avoiding "is this part
            of the form?" confusion). */}
        <aside
          aria-label="Telefonická rezervácia"
          className="mt-8 flex flex-col items-center gap-2.5 rounded-2xl border border-border/50 bg-card/60 px-4 py-4 text-center sm:mt-10 sm:flex-row sm:justify-center sm:gap-4 sm:py-3.5"
        >
          <p className="text-[14px] text-muted-foreground sm:text-[15px]">
            Radšej zavoláte? Sme tu pre vás.
          </p>
          <a
            href={`tel:${SHOP_PHONE_E164}`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[15px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            <PhoneIcon className="size-4" />
            {SHOP_PHONE_DISPLAY}
          </a>
        </aside>
      </main>
      <noscript>
        <p className="p-8 text-center text-muted-foreground">
          Pre použitie rezervačného systému je potrebný JavaScript.
        </p>
      </noscript>

      {/* Visual break between the booking flow (form + phone CTA) and the
          supplementary SEO content below — gradient hairline with a small
          centered chip so it reads as "you've left the booking section." */}
      <div
        aria-hidden="true"
        className="relative my-16 flex items-center justify-center sm:my-20"
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="relative rounded-full border border-border/60 bg-background px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Viac o nás
        </span>
      </div>

      <section
        aria-labelledby="o-barbershope"
        className="rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8"
      >
        <h2
          id="o-barbershope"
          className="text-lg font-bold tracking-tight sm:text-xl"
        >
          O barbershope Strojček
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          V Bytči nás nájdete pod značkou <strong className="font-semibold text-foreground">Bytča barber Strojček</strong> — pánsky barber shop,
          ktorý kombinuje klasické remeslo s online rezerváciou. Strojček je
          pánsky barber shop v Bytči — pánsky kaderník v okolí Žiliny pre
          všetkých, ktorí chcú profesionálny strih bez kompromisov. Chodia
          k nám zákazníci z Bytče, Malej Bytče, Predmiera, Hričovského
          Podhradia, Súľova-Hradnej, Hvozdnice, Štiavnika, Hliníka nad Váhom,
          Kotešovej, Veľkého Rovného, Petrovíc, Kolárovíc, Jablonového, Dolného
          Hričova, Horného Hričova aj z Považskej Bystrice. Robíme{" "}
          <Link
            href="/sluzby/pansky-strih"
            className="font-medium text-foreground underline-offset-2 hover:text-primary-strong hover:underline"
          >
            klasický pánsky strih
          </Link>
          ,{" "}
          <Link
            href="/sluzby/fade-strih"
            className="font-medium text-foreground underline-offset-2 hover:text-primary-strong hover:underline"
          >
            fade strih
          </Link>
          ,{" "}
          <Link
            href="/sluzby/uprava-brady"
            className="font-medium text-foreground underline-offset-2 hover:text-primary-strong hover:underline"
          >
            úpravu brady aj úpravu fúzov
          </Link>
          ,{" "}
          <Link
            href="/sluzby/hot-towel-ritual"
            className="font-medium text-foreground underline-offset-2 hover:text-primary-strong hover:underline"
          >
            hot towel rituál
          </Link>{" "}
          a komplexnú starostlivosť o vlasy. Vďaka online rezervácii prídete
          do nášho barbershopu na presný čas — bez čakania v rade a s istotou,
          že vás obslúžime kedy potrebujete.
        </p>

        {/* Photo peek — wraps the row in a single Link so the whole strip
            (and each thumbnail) is one big tap target heading to /o-nas.
            Goal is to entice the click rather than to be a real gallery,
            so we show 4 thumbs with a "+1" overlay on the last tile. */}
        <Link
          href="/o-nas#priestory"
          aria-label="Pozrieť priestory a celú galériu na stránke O nás"
          className="group mt-5 block focus:outline-none"
        >
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {/* Uses pre-baked -thumb.webp (320px wide, ~13 KB each) generated
                by scripts/generate-image-variants.ts. Firebase App Hosting's
                outdated FAH adapter doesn't expose /_next/image on Next.js 16
                (returns 404), so we serve the right size statically instead
                of relying on the broken runtime optimizer. See
                github.com/firebase/apphosting-adapters/issues/564. */}
            {[
              {
                src: "/barbershop/interier-bytca-1-p-thumb.webp",
                alt: "Interiér barbershopu Strojček v Bytči",
              },
              {
                src: "/barbershop/barberske-kreslo-bytca-p-thumb.webp",
                alt: "Barberské kreslo a pracovisko v Strojčeku Bytča",
              },
              {
                src: "/barbershop/pracovisko-barber-bytca-p-thumb.webp",
                alt: "Detail pracoviska barbera v Strojčeku Bytča",
              },
              {
                src: "/barbershop/priestory-strojcek-bytca-p-thumb.webp",
                alt: "Priestory pánskeho barbershopu Strojček v Bytči",
              },
            ].map((photo, i, arr) => (
              <div
                key={photo.src}
                className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border/40 bg-card transition-colors duration-300 group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-primary/60"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 640px) 130px, 22vw"
                  quality={70}
                  loading="lazy"
                  className="object-cover"
                />
                {i === arr.length - 1 ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/65 via-black/30 to-transparent">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white sm:text-[12px]">
                      +1 viac
                    </span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <span className="mt-2 inline-block text-[12px] text-muted-foreground transition-colors group-hover:text-primary-strong">
            Galéria priestorov v Bytči →
          </span>
        </Link>

        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
          <Link
            href="/o-nas"
            className="font-medium text-primary-strong underline-offset-2 hover:underline"
          >
            Viac o našom príbehu, barberovi Martinovi a tipoch →
          </Link>
          <Link
            href="/cennik"
            className="font-medium text-primary-strong underline-offset-2 hover:underline"
          >
            Pozrieť cenník →
          </Link>
        </p>

        {/* Instagram reel — click-to-load to avoid Meta cookies/scripts
            on first paint and keep the homepage fast. Height reduced vs
            /o-nas (560 vs 720) since this is a secondary placement. */}
        <div className="mt-6">
          <p className="mb-3 text-[13px] font-medium text-muted-foreground">
            Pozri nás v akcii na Instagrame
          </p>
          <InstagramEmbed
            src="https://www.instagram.com/p/DSb9TjJjci1/embed"
            title="Strojček Barbershop — ukážka práce na Instagrame"
            height={560}
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href="https://www.instagram.com/p/DSb9TjJjci1/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary-strong"
            >
              <InstagramIcon className="size-4" />
              Otvoriť na Instagrame
            </a>
            <a
              href="https://www.instagram.com/strojcek_/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary-strong"
            >
              @strojcek_
            </a>
          </div>
        </div>
      </section>

      <ServicesSection />

      <ReviewsSection />

      <FaqSection />

      <FaqJsonLd />

      <BookingCta />

      <SiteFooter hours={openingHours} />
    </BookingShell>
  );
}
