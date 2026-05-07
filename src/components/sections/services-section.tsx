import Link from "next/link";

interface ServiceCard {
  slug: string;
  title: string;
  description: string;
  span?: boolean;
}

const SERVICE_CARDS: ServiceCard[] = [
  {
    slug: "pansky-strih",
    title: "Klasický pánsky strih",
    description:
      "Strih nožnicami a strojčekom podľa tvaru tváre a typu vlasov. Súčasťou je krátka konzultácia, presný strih, umytie vlasov a finálny styling. Výsledok drží niekoľko týždňov a vyzerá čisto aj po pár dňoch.",
  },
  {
    slug: "fade-strih",
    title: "Fade strih",
    description:
      "Plynulý prechod od kratšej dĺžky pri pokožke k dlhšej hore — low fade, mid fade, high fade aj skin fade. Detailná práca strojčekom a britvou. Trendová alternatíva ku klasickému strihu, ideálna pre kratší vrchný styling.",
  },
  {
    slug: "uprava-brady",
    title: "Úprava brady a fúzov",
    description:
      "Strih a tvarovanie brady nožnicami aj britvou. Hot towel pred holením otvorí póry a uvoľní pokožku, takže výsledok je hladký a podráždenie minimálne. Olej alebo balzam sú súčasťou.",
  },
  {
    slug: "hot-towel-ritual",
    title: "Hot towel rituál",
    description:
      "Tradičná barberská metóda holenia — horúce uteráky, parou zmäkčená brada, presné ťahy britvou. Výsledkom je dokonale hladká pokožka a relaxačný zážitok. Odporúčame raz za 2–3 týždne.",
  },
  {
    slug: "strojcek-ritual",
    title: "Strojček rituál",
    description:
      "Naša signatúrna kombinácia — strih, úprava brady, hot towel a vosková finálna úprava. Komplexný balík pre tých, ktorí si chcú dopriať full service a odísť kompletne upravení od hlavy po bradu. Trvá približne 75 minút.",
    span: true,
  },
];

interface ServicesSectionProps {
  className?: string;
}

export function ServicesSection({
  className = "mt-8 rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8",
}: ServicesSectionProps) {
  return (
    <section aria-labelledby="nase-sluzby" className={className}>
      <h2
        id="nase-sluzby"
        className="text-lg font-bold tracking-tight sm:text-xl"
      >
        Naše služby
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        V našom barber shope v Bytči robíme všetko od klasického pánskeho
        strihu cez moderné fade strihy až po komplexnú úpravu brady. Aktuálne
        ceny a presnú dĺžku trvania jednotlivých služieb vidíte v rezervačnom
        kroku „Služba“.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {SERVICE_CARDS.map((service) => (
          <Link
            key={service.slug}
            href={`/sluzby/${service.slug}`}
            className={`group -m-3 rounded-xl p-3 transition-colors hover:bg-card/60${
              service.span ? " sm:col-span-2" : ""
            }`}
          >
            <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary">
              {service.title}
            </h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              {service.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
