export const revalidate = 1800;

import type { Metadata } from "next";
import { getActiveServices } from "@/server/queries/services";
import {
  getActiveBarbersWithServices,
  getShopOpeningHours,
} from "@/server/queries/barbers";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { BookingShell } from "@/components/booking/booking-shell";
import { StructuredData } from "@/components/structured-data";
import Image from "next/image";
import Link from "next/link";
import { ServicesSection } from "@/components/sections/services-section";
import { ReviewsSection } from "@/components/sections/reviews-section";
import { FaqSection, FaqJsonLd } from "@/components/sections/faq-section";
import { SiteFooter } from "@/components/sections/site-footer";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [services, barbers, openingHours] = await Promise.all([
    getActiveServices(),
    getActiveBarbersWithServices(),
    getShopOpeningHours(),
  ]);

  const serializedServices = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    price: s.price.toString(),
  }));

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
      <header className="mb-6 flex flex-col items-center text-center sm:mb-8">
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
        <p className="mt-1.5 text-[12px] font-medium uppercase tracking-widest text-muted-foreground">
          Online rezervácia
        </p>
      </header>

      <main>
        <BookingWizard services={serializedServices} barbers={barbers} />
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
        <p className="mt-4 text-[14px]">
          <Link
            href="/o-nas"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Viac o našom príbehu, barberovi Martinovi a tipoch →
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
