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
import {
  SHOP_CITY,
  SHOP_EMAIL,
  SHOP_MAPS_URL,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_E164,
  SHOP_POSTAL_CODE,
  SHOP_STREET,
} from "@/lib/business-info";
import Image from "next/image";
import Link from "next/link";

const INSTAGRAM_URL = "https://www.instagram.com/strojcek_/";
const FACEBOOK_URL =
  "https://www.facebook.com/p/Stroj%C4%8Dek-61576655767286/";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const SK_DAY_NAMES: Record<string, string> = {
  Monday: "Pondelok",
  Tuesday: "Utorok",
  Wednesday: "Streda",
  Thursday: "Štvrtok",
  Friday: "Piatok",
  Saturday: "Sobota",
  Sunday: "Nedeľa",
};

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Ako sa objednám na termín?",
    a: "Rezerváciu spravíte priamo na tejto stránke v 6 krokoch — vyberiete službu, barbera, dátum, voľný čas, vyplníte kontakt a potvrdíte. Potvrdenie príde emailom a deň pred termínom dostanete pripomienku.",
  },
  {
    q: "Koľko trvá pánsky strih?",
    a: "Klasický pánsky strih trvá 30–45 minút, kombinácia strihu s úpravou brady okolo 60 minút. Presné trvanie každej služby vidíte priamo v rezervačnom kroku „Služba“.",
  },
  {
    q: "Aké sú ceny služieb?",
    a: "Aktuálny cenník je v rezervačnom formulári pri každej službe (pánsky strih, úprava brady, hot towel rituál, študentský strih a kombinácie). Ceny zahŕňajú DPH.",
  },
  {
    q: "Kde sa salón nachádza?",
    a: "Strojček nájdete na adrese Moyzesova 379/2, 014 01 Bytča. Sme priamo v centre, parking je dostupný v okolí.",
  },
  {
    q: "Robíte fade strih a úpravu fúzov?",
    a: "Áno — okrem klasického pánskeho strihu robíme aj fade strih, taper, údržbu vlasov a úpravu fúzov nožnicami aj britvou. Hot towel rituál je súčasťou kompletnej úpravy brady.",
  },
  {
    q: "Mám prísť skôr ako začína môj termín?",
    a: "Stačí prísť 5 minút pred termínom. Online systém zobrazuje len reálne voľné okná, takže nečakáte v rade — sme nachystaní presne na váš čas.",
  },
  {
    q: "Môžem zrušiť alebo zmeniť rezerváciu?",
    a: "Áno. V potvrdzovacom emaili je odkaz na zrušenie rezervácie. Rezerváciu môžete zrušiť najneskôr 2 hodiny pred termínom; pre zmenu času nás kontaktujte telefonicky.",
  },
  {
    q: "Je potrebná platba vopred?",
    a: "Nie. Rezervácia online je bezplatná a nezáväzná pre platbu — platí sa až priamo v salóne.",
  },
];

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

        <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-10">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Kontakt
            </h3>
            <address className="mt-3 space-y-2.5 text-[15px] not-italic leading-snug">
              <a
                href={SHOP_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block underline-offset-2 hover:underline"
              >
                <span className="block">{SHOP_STREET}</span>
                <span className="block text-muted-foreground">
                  {SHOP_POSTAL_CODE.slice(0, 3)} {SHOP_POSTAL_CODE.slice(3)}{" "}
                  {SHOP_CITY}
                </span>
              </a>
              <a
                href={`tel:${SHOP_PHONE_E164}`}
                className="block tabular-nums underline-offset-2 hover:underline"
              >
                {SHOP_PHONE_DISPLAY}
              </a>
              <a
                href={`mailto:${SHOP_EMAIL}`}
                className="inline-block max-w-full text-[14px] underline-offset-2 [overflow-wrap:anywhere] hover:underline"
              >
                {(() => {
                  const at = SHOP_EMAIL.indexOf("@");
                  return (
                    <>
                      {SHOP_EMAIL.slice(0, at)}
                      <wbr />
                      {SHOP_EMAIL.slice(at)}
                    </>
                  );
                })()}
              </a>
            </address>
            <div className="mt-4 flex items-center gap-2">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Strojček na Instagrame"
                className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
              >
                <InstagramIcon className="size-4" />
              </a>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Strojček na Facebooku"
                className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
              >
                <FacebookIcon className="size-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Otváracie hodiny
            </h3>
            {openingHours.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted-foreground">
                Otváracie hodiny sú k dispozícii v rezervačnom kalendári.
              </p>
            ) : (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[15px]">
                {openingHours.map((h) => (
                  <div key={h.dayOfWeek} className="contents">
                    <dt>{SK_DAY_NAMES[h.dayOfWeek] ?? h.dayOfWeek}</dt>
                    <dd className="tabular-nums text-muted-foreground">
                      {h.opens.slice(0, 5)} – {h.closes.slice(0, 5)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="caste-otazky"
        className="mt-8 rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8"
      >
        <h2
          id="caste-otazky"
          className="text-lg font-bold tracking-tight sm:text-xl"
        >
          Časté otázky
        </h2>
        <div className="mt-4 divide-y divide-border/40">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group py-3 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium leading-snug">
                <span>{q}</span>
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: {
                "@type": "Answer",
                text: a,
              },
            })),
          }),
        }}
      />

      <footer className="mt-10 border-t border-border/40 pt-6 text-center text-[13px] text-muted-foreground">
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
    </BookingShell>
  );
}
