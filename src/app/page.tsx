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
import { CalendarCheckIcon, ChevronDownIcon } from "lucide-react";
import { ServicesSection } from "@/components/sections/services-section";
import { ReviewsSection } from "@/components/sections/reviews-section";
import { FaqSection, FaqJsonLd } from "@/components/sections/faq-section";
import { SiteFooter } from "@/components/sections/site-footer";

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
          alt="Strojček — pánsky barbershop Bytča"
          width={140}
          height={76}
          className="rounded-xl shadow-lg shadow-black/20"
          priority
        />
        <h1 className="mt-3 text-xl font-bold tracking-tight text-primary sm:text-2xl">
          Strojček — pánsky barbershop v Bytči
        </h1>
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
          <div className="border-b border-border/40 bg-primary/[0.08] px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex items-center justify-center gap-3 sm:gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:size-11">
                <CalendarCheckIcon className="size-[18px] sm:size-5" />
              </div>
              <h2
                id="rezervacia-heading"
                className="text-center text-[16px] font-bold leading-snug tracking-tight text-foreground sm:text-[17px]"
              >
                Rezervačný formulár
              </h2>
            </div>
            <div
              aria-hidden="true"
              className="mt-1.5 flex justify-center text-primary/70 sm:mt-2"
            >
              <ChevronDownIcon className="size-5 motion-safe:animate-bounce" />
            </div>
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
      </main>
      <noscript>
        <p className="p-8 text-center text-muted-foreground">
          Pre použitie rezervačného systému je potrebný JavaScript.
        </p>
      </noscript>

      <section
        aria-labelledby="o-barbershope"
        className="mt-12 rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8"
      >
        <h2
          id="o-barbershope"
          className="text-lg font-bold tracking-tight sm:text-xl"
        >
          O barbershope Strojček
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Strojček je pánsky barber shop v Bytči — pánsky kaderník v okolí
          Žiliny pre všetkých, ktorí chcú profesionálny strih bez kompromisov.
          Chodia k nám zákazníci z Bytče, Predmiera, Hričovského Podhradia,
          Súľova-Hradnej aj z Považskej Bystrice. Robíme klasický pánsky strih,
          fade strih, úpravu brady aj úpravu fúzov, hot towel rituál a
          komplexnú starostlivosť o vlasy. Vďaka online rezervácii prídete do
          nášho barbershopu na presný čas — bez čakania v rade a s istotou, že
          vás obslúžime kedy potrebujete.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
          <Link
            href="/o-nas"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Viac o našom príbehu, barberovi Martinovi a tipoch →
          </Link>
          <Link
            href="/cennik"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Pozrieť cenník →
          </Link>
        </p>
      </section>

      <ServicesSection />

      <ReviewsSection />

      <FaqSection />

      <FaqJsonLd />

      <SiteFooter hours={openingHours} />
    </BookingShell>
  );
}
