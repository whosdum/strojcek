export const FAQ: Array<{ q: string; a: string }> = [
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
    q: "Kde sa barber shop v Bytči nachádza?",
    a: "Strojček Barbershop nájdete v centre Bytče na adrese Moyzesova 379/2, 014 01 Bytča. Sme pár minút pešo od námestia a parking je dostupný priamo na ulici aj v okolí. Najbližšie autobusové zastávky sú v dochádzkovej vzdialenosti.",
  },
  {
    q: "Z akých miest k vám chodia zákazníci?",
    a: "Okrem Bytče k nám chodia pánski zákazníci aj z okolia — Predmier, Hričovské Podhradie, Súľov-Hradná, Považská Bystrica aj zo Žiliny. Bytča je dostupná z celého Žilinského kraja a online rezervácia šetrí čas — prídete na presný termín bez čakania.",
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

interface FaqSectionProps {
  className?: string;
}

export function FaqSection({
  className = "mt-8 rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8",
}: FaqSectionProps) {
  return (
    <section aria-labelledby="caste-otazky" className={className}>
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
  );
}

export function FaqJsonLd() {
  return (
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
  );
}
