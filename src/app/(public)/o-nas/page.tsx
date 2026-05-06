import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeftIcon, ScissorsIcon } from "lucide-react";
import {
  PUBLIC_SITE_URL,
  SHOP_ADDRESS_FULL,
  SHOP_CITY,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_E164,
} from "@/lib/business-info";

export const revalidate = 86400;

const PAGE_TITLE = "O nás — Strojček Barbershop Bytča";
const PAGE_DESCRIPTION =
  "Príbeh barbershopu Strojček v Bytči, predstavenie barbera Martina, naše priestory a rady, ako sa starať o vlasy a bradu medzi termínmi.";

const INSTAGRAM_PROFILE = "https://www.instagram.com/strojcek_/";
const INSTAGRAM_REEL_URL = "https://www.instagram.com/p/DSb9TjJjci1/";
const INSTAGRAM_REEL_EMBED = "https://www.instagram.com/p/DSb9TjJjci1/embed";

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

const INTERIOR_PHOTOS: Array<{
  src: string;
  alt: string;
  caption: string;
}> = [
  {
    src: "/barbershop/interier-bytca-1.jpeg",
    alt: "Interiér barbershopu Strojček v Bytči — barberské kreslo a zrkadlo",
    caption: "Interiér Strojček Barbershop, Bytča",
  },
  {
    src: "/barbershop/priestory-strojcek-bytca.jpeg",
    alt: "Priestory pánskeho barbershopu Strojček v Bytči",
    caption: "Naše priestory v centre Bytče",
  },
  {
    src: "/barbershop/barberske-kreslo-bytca.jpeg",
    alt: "Barberské kreslo a pracovisko v Strojčeku Bytča",
    caption: "Pracovisko barbera",
  },
  {
    src: "/barbershop/pracovisko-barber-bytca.jpeg",
    alt: "Detail pracoviska barbera v barbershope Strojček Bytča",
    caption: "Detail pracoviska",
  },
  {
    src: "/barbershop/interier-bytca-2.jpeg",
    alt: "Interiér Strojček barbershopu v Bytči — pohľad na čakaciu zónu",
    caption: "Čakacia zóna",
  },
];

const TIPS: Array<{ title: string; body: string }> = [
  {
    title: "Ako často chodiť na pánsky strih",
    body:
      "Klasický pánsky strih drží 4–6 týždňov. Fade strih a kratšie strihy treba osviežiť skôr — ideálne každé 3–4 týždne, inak prechody „vyrastú“ a stratia ostrosť. Pravidelný interval drží účes čistý a zároveň šetrí čas — barber sa venuje len tomu, čo treba doladiť, nie celej prestavbe.",
  },
  {
    title: "Ako sa starať o vlasy doma",
    body:
      "Šampón vyberajte podľa typu vlasov a pokožky, nie podľa reklamy. Mastné vlasy potrebujú jemný čistiaci šampón, suché skôr hydratačný. Umývajte vlasy 2–3× týždenne — denné umývanie zbavuje pokožku prirodzeného mazu. Po umytí vlasy nechajte uschnúť pri izbovej teplote alebo fénujte na strednú teplotu.",
  },
  {
    title: "Starostlivosť o bradu medzi termínmi",
    body:
      "Bradu si umývajte každý druhý deň jemným šampónom alebo špeciálnym brada-šampónom. Po umytí použite olej na bradu — pár kvapiek do dlane, vmasírovať od koreňov. Olej zmäkčí chĺpky aj pokožku pod bradou a zabráni svrbeniu. Drobné zachytávanie chĺpkov pri brade na lícach pokojne dorovnajte britvou alebo trimerom — väčšiu úpravu nechajte barberovi.",
  },
  {
    title: "Ako si pripraviť presnú objednávku",
    body:
      "Pred návštevou si premyslite, čo chcete — dĺžku v centimetroch alebo na akom čísle strojčeka, kde má byť prechod, či chcete po stranách kratšie alebo dlhšie. Ak máte fotku štýlu z internetu, ukážte ju — aj nedokonalá referencia barberovi vraví viac ako desať viet. Konkrétny popis šetrí čas obom.",
  },
  {
    title: "Rozdiel medzi klasickým strihom a fade",
    body:
      "Klasický pánsky strih má rovnomernú dĺžku po stranách, prípadne ostrý prechod nožnicami. Fade je plynulý prechod od pokožky (alebo veľmi krátkej dĺžky) k dlhšej hore — bez viditeľnej hrany. Fade sa hodí, ak chcete kontrastný look a nevadí vám častejšia údržba; klasika ak chcete strih, ktorý vydrží dlhšie.",
  },
  {
    title: "Ako si vybrať styling produkt",
    body:
      "Pre jemné vlasy zvoľte ľahšie produkty — krém alebo lak so strednou fixáciou. Hrubé vlasy zvládnu vosk alebo pomádu so silnejšou fixáciou. Matné finiše (clay, paste) sú teraz trendy — vyzerajú prirodzene, ako keby tam produkt ani nebol. Lesklé pomády pasujú ku klasickým strihom v retro štýle.",
  },
];

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/o-nas" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${PUBLIC_SITE_URL}/o-nas`,
    type: "website",
    siteName: "Strojček Barbershop",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

function AboutJsonLd() {
  const aboutLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${PUBLIC_SITE_URL}/o-nas`,
    mainEntity: {
      "@type": "BarberShop",
      "@id": `${PUBLIC_SITE_URL}/#localbusiness`,
      name: "Strojček Barbershop",
      url: PUBLIC_SITE_URL,
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: `${PUBLIC_SITE_URL}/barbers/martin.png`,
      caption: "Martin — barber a zakladateľ Strojček Barbershop",
    },
  };

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Martin",
    jobTitle: "Barber",
    worksFor: {
      "@type": "BarberShop",
      "@id": `${PUBLIC_SITE_URL}/#localbusiness`,
      name: "Strojček Barbershop",
    },
    image: `${PUBLIC_SITE_URL}/barbers/martin.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Moyzesova 379/2",
      addressLocality: SHOP_CITY,
      postalCode: "01401",
      addressCountry: "SK",
    },
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
        name: "O nás",
        item: `${PUBLIC_SITE_URL}/o-nas`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AboutJsonLd />

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" />
          Späť na rezerváciu
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
            <li className="text-foreground">O nás</li>
          </ol>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          O Strojčeku — pánsky barbershop v Bytči
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Strojček Barbershop je pánsky barber v Bytči, ktorý vznikol z jedného
          jednoduchého presvedčenia — že kvalitný strih a profesionálnu úpravu
          brady by mal nájsť aj pán z menšieho mesta, nielen z Bratislavy či
          Žiliny. Pracujeme pre zákazníkov z Bytče a širšieho okolia: Predmier,
          Hričovské Podhradie, Súľov-Hradná aj Považská Bystrica.
        </p>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">
            Náš príbeh
          </h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              Strojček vznikol z toho, že v Bytči dlho chýbalo miesto, kde sa
              pán môže nechať ostrihať bez kompromisov. Pánska holičňa, kde
              barber rozumie modernému fade strihu, ovláda klasické techniky,
              ostrí britvu a vie, prečo treba pred holením použiť horúci uterák.
              Také miesto, kam prídete, posadíte sa, otvoríte si telefón na pol
              hodinu a odídete s pocitom, že to bol dobre strávený čas.
            </p>
            <p>
              Začínali sme s jediným kreslom a postupne sme priestor doladili
              tak, ako si predstavujeme barbershop — tlmené svetlo, drevo,
              kvalitné nástroje a žiadne zbytočné rozptyľovanie. Nemáme
              hudbu nahlas, nemáme reklamu na stenách. Záleží nám len na strihu,
              brade a tom, aby ste odchádzali spokojní.
            </p>
            <p>
              Online rezervačný systém spustil druhú vlnu zákazníkov — pánov,
              ktorí nechcú čakať v rade ani volať, jednoducho si vyberú voľný
              termín cez web a prídu presne, keď im to vyhovuje. To nám dáva čas
              venovať sa každému zákazníkovi tak, ako si to služba zaslúži.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">
            Martin — barber za pultom
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-[140px_1fr] sm:items-start">
            <div className="relative aspect-square w-32 overflow-hidden rounded-2xl border border-border/40 bg-card sm:w-full">
              <Image
                src="/barbers/martin.png"
                alt="Martin — barber a zakladateľ Strojček Barbershop v Bytči"
                fill
                sizes="(min-width: 640px) 140px, 128px"
                className="object-cover"
              />
            </div>
            <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
              <p>
                Martin je hlavný barber v Strojčeku. Robí všetky druhy
                pánskych strihov — od klasiky cez fade rôznych výšok až po
                úpravu brady britvou a hot towel rituál. Konzultuje s každým
                zákazníkom, čo bude sedieť k tvaru tváre a typu vlasov, a
                neponáhľa sa.
              </p>
              <p>
                K barberskému remeslu sa dostal cez záujem o detail a precízne
                práce — fade nie je o rýchlosti, ale o presnosti. Kombinuje
                klasické techniky s moderným prístupom a investuje do kvalitných
                nástrojov a pánskej kozmetiky, ktorá robí rozdiel.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">
            Naše priestory
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Barbershop nájdete na adrese {SHOP_ADDRESS_FULL} — pár minút pešo
            od námestia v Bytči. Parking je dostupný priamo na ulici aj
            v okolí. Pri rezervácii si vyberiete presný čas, takže netreba
            čakať — prídete, ostriháte sa a idete ďalej.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {INTERIOR_PHOTOS.slice(0, 4).map((photo) => (
              <figure
                key={photo.src}
                className="overflow-hidden rounded-xl border border-border/40 bg-card"
              >
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="px-3 py-2 text-[12px] text-muted-foreground">
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border/40 bg-card/40 p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <InstagramIcon className="size-4 text-primary" />
            Pozri nás v akcii
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Krátke video z barbershopu — pohľad na fade strih a atmosféru.
            Pre viac obsahu sledujte náš Instagram, kde pravidelne pridávame
            ukážky práce.
          </p>

          <div className="mt-5 overflow-hidden rounded-xl border border-border/40 bg-card">
            <iframe
              src={INSTAGRAM_REEL_EMBED}
              title="Strojček Barbershop — ukážka práce na Instagrame"
              loading="lazy"
              allow="encrypted-media"
              allowFullScreen
              className="block w-full"
              style={{ height: 720, border: 0 }}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href={INSTAGRAM_REEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <InstagramIcon className="size-4" />
              Otvoriť na Instagrame
            </a>
            <a
              href={INSTAGRAM_PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              @strojcek_
            </a>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ScissorsIcon className="size-4 text-primary" />
            Rady a tipy od barbera
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Pár vecí, ktoré sa pýtajú zákazníci najčastejšie — ako sa starať
            o vlasy a bradu medzi termínmi a čo si treba uvedomiť pred prvou
            návštevou.
          </p>
          <div className="mt-6 space-y-6">
            {TIPS.map((tip) => (
              <article key={tip.title}>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {tip.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                  {tip.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
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
