import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Všeobecné obchodné podmienky — Strojček",
  description:
    "Všeobecné obchodné podmienky pre online rezervácie v barbershope Strojček",
};

export default function VopPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" />
          Späť na rezerváciu
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Všeobecné obchodné podmienky
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          pre online rezervácie
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90">
          {/* Section 1 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              1. Úvodné ustanovenia
            </h2>
            <div className="space-y-3">
              <p>
                <strong>1.1.</strong> Tieto VOP upravujú zmluvný vzťah medzi:
              </p>
              <p className="pl-4">
                <strong>Prevádzkovateľom:</strong> STROJČEK s.r.o., Moyzesova
                379/2, Bytča, IČO: 57286477, DIČ: 2122649100, e-mail:{" "}
                <a
                  href="mailto:strojcekbarbershop@gmail.com"
                  className="text-primary underline underline-offset-2"
                >
                  strojcekbarbershop@gmail.com
                </a>
                , tel.:{" "}
                <a
                  href="tel:+421944932871"
                  className="text-primary underline underline-offset-2"
                >
                  +421 944 932 871
                </a>
              </p>
              <p className="pl-4">
                a <strong>Zákazníkom:</strong> osobou, ktorá si rezervuje služby
                prostredníctvom online rezervačného systému.
              </p>
              <p>
                <strong>1.2.</strong> Zmluvný vzťah vzniká výlučne medzi
                Prevádzkovateľom a Zákazníkom.
              </p>
              <p>
                <strong>1.3.</strong> Zákazník potvrdzuje súhlas s týmito VOP
                pred odoslaním rezervácie. Špecifické podmienky Prevádzkovateľa
                (napr. prevádzkový poriadok, obchodné podmienky, detailné storno
                podmienky a pod.) majú v prípade rozporu prednosť pred týmito
                VOP.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              2. Definície
            </h2>
            <div className="space-y-2">
              <p>
                <strong>Zákazník:</strong> fyzická alebo právnická osoba, ktorá
                objednáva plnenie Prevádzkovateľa.
              </p>
              <p>
                <strong>Služby:</strong> služby ponúkané Prevádzkovateľom.
              </p>
              <p>
                <strong>Rezervácia:</strong> elektronické objednanie termínu
                služby.
              </p>
              <p>
                <strong>No-show:</strong> situácia, keď sa Zákazník nedostaví
                bez včasného zrušenia rezervácie.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              3. Uzavretie zmluvy
            </h2>
            <div className="space-y-3">
              <p>
                <strong>3.1.</strong> Zákazník je povinný uvádzať pravdivé
                a aktuálne údaje.
              </p>
              <p>
                <strong>3.2.</strong> Zmluva vzniká okamihom potvrdenia
                rezervácie Prevádzkovateľom (e-mail, SMS, notifikácia).
              </p>
              <p>
                <strong>3.3.</strong> Odoslaním rezervácie Zákazník potvrdzuje,
                že sa oboznámil s týmito VOP a súhlasí s nimi.
              </p>
              <p>
                <strong>3.4.</strong> Aktuálny rozsah služieb, ich popis a ceny
                sú zverejnené na webovej stránke alebo v prevádzke
                Prevádzkovateľa.
              </p>
              <p>
                <strong>3.5.</strong> Ceny sú uvedené vrátane DPH.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              4. Práva a povinnosti Zákazníka / Prevádzkovateľa
            </h2>
            <div className="space-y-3">
              <p>
                <strong>4.1.</strong> Zákazník má právo na riadne, odborné
                a včasné poskytnutie Služby, na informácie o cene / rozsahu a na
                uplatnenie reklamácie podľa čl. 7 VOP.
              </p>
              <p>
                <strong>4.2.</strong> Zákazník je povinný dostaviť sa včas,
                riadiť sa pokynmi Prevádzkovateľa a uviesť údaje pravdivo
                a úplne.
              </p>
              <p>
                <strong>4.3.</strong> Zákazník zodpovedá za škodu spôsobenú
                v priestoroch Prevádzkovateľa.
              </p>
              <p>
                <strong>4.4.</strong> Zákazník berie na vedomie, že
                Prevádzkovateľ je oprávnený zabrániť vo vykonaní rezervácie
                zákazníkovi, ktorý predtým podstatným spôsobom porušil tieto
                VOP. Podstatným porušením je aj nevyužitie rezervácie a jej
                nestornovanie.
              </p>
              <p>
                <strong>4.5.</strong> Prevádzkovateľ poskytuje Služby s odbornou
                starostlivosťou a v súlade s právnymi predpismi.
              </p>
              <p>
                <strong>4.6.</strong> Prevádzkovateľ je oprávnený odmietnuť
                poskytnutie Služby v odôvodnených prípadoch (napr. agresívne
                konanie, zjavne nevhodný zdravotný stav, porušovanie
                prevádzkového poriadku).
              </p>
              <p>
                <strong>4.7.</strong> Prevádzkovateľ zodpovedá za obsah ponuky,
                termíny, komunikáciu a plnenie Služieb.
              </p>
              <p>
                <strong>4.8.</strong> Zákazník berie na vedomie, že
                Prevádzkovateľ nezodpovedá za funkčnosť dátovej siete,
                hardvérového vybavenia, programového vybavenia alebo iných
                služieb od externých dodávateľov, ako ani za prípadné
                neposkytnutie služby v prípadoch výpadku dodávky elektrickej
                energie, výpadku dátovej siete, iných porúch spôsobených
                tretími osobami alebo zásahom vyššej moci.
              </p>
              <p>
                <strong>4.9.</strong> Prevádzkovateľ zodpovedá za škodu
                spôsobenú porušením svojich právnych povinností. Povinnosť
                Prevádzkovateľa na náhradu predvídateľnej škody je obmedzená do
                výšky ceny Služby skutočne zaplatenej Zákazníkom, pričom toto
                obmedzenie sa nevzťahuje na škodu spôsobenú úmyselne, z hrubej
                nedbalosti alebo na ujmu na zdraví.
              </p>
              <p>
                <strong>4.10.</strong> Rezervácia sa uzatvára na diaľku
                prostredníctvom elektronických prostriedkov. Právo na odstúpenie
                sa posudzuje podľa Občianskeho zákonníka. Pri službách
                poskytovaných v konkrétnom termíne sa uplatňujú storno podmienky
                podľa čl. 6.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              5. Platobné dojednania
            </h2>
            <div className="space-y-3">
              <p>
                <strong>5.1.</strong> Cena služby sa uhrádza na mieste
                v prevádzke Prevádzkovateľa (v hotovosti alebo platobnou
                kartou).
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              6. Zmeny, zrušenie a storno podmienky
            </h2>
            <div className="space-y-3">
              <p>
                <strong>6.1.</strong> Zákazník je oprávnený zmeniť alebo zrušiť
                rezerváciu najneskôr 2 hodiny pred začiatkom rezervovaného
                termínu.
              </p>
              <p>
                <strong>6.2.</strong> Storno podmienky a storno poplatky: Pri
                neskorom zrušení alebo nedostavení sa (No-show) môže
                Prevádzkovateľ účtovať storno poplatok.
              </p>
              <p>
                <strong>6.3.</strong> Zrušenie Prevádzkovateľom: Prevádzkovateľ
                môže rezerváciu zrušiť z prevádzkových dôvodov (choroba,
                technické problémy); o tom informuje Zákazníka bezodkladne
                a môže mu ponúknuť náhradný termín.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              7. Reklamácie a sťažnosti
            </h2>
            <div className="space-y-3">
              <p>
                <strong>7.1.</strong> Služba: Reklamáciu služby uplatňuje
                Zákazník bez zbytočného odkladu po poskytnutí služby, a to
                osobne alebo prostredníctvom kontaktných informácií uvedených na
                stránke Prevádzkovateľa.
              </p>
              <p>
                <strong>7.2.</strong> Prevádzkovateľ vybaví reklamáciu
                najneskôr do 30 dní (u spotrebiteľov), ak právnymi predpismi
                nie je ustanovené inak.
              </p>
              <p>
                <strong>7.3.</strong> Ak nie je Zákazník spokojný, môže sa
                obrátiť na Slovenskú obchodnú inšpekciu (
                <a
                  href="https://www.soi.sk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  www.soi.sk
                </a>
                ).
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              8. Ochrana osobných údajov a komunikácia
            </h2>
            <div className="space-y-3">
              <p>
                <strong>8.1.</strong> Prevádzkovateľom osobných údajov Zákazníka
                je Prevádzkovateľ. Účelom spracúvania je najmä rezervácia,
                komunikácia a plnenie Služieb, evidencia a splnenie zákonných
                povinností.
              </p>
              <p>
                <strong>8.2.</strong> Zákazník súhlasí s tým, že mu všetky
                informácie, potvrdenia a dokumenty súvisiace s vytvorenou
                Rezerváciou budú doručované elektronicky, a to prostredníctvom
                e-mailu alebo SMS.
              </p>
              <p>
                <strong>8.3.</strong> Podrobné Zásady spracúvania osobných
                údajov sú dostupné na{" "}
                <Link
                  href="/ochrana-udajov"
                  className="text-primary underline underline-offset-2"
                >
                  webovej stránke Prevádzkovateľa
                </Link>
                .
              </p>
              <p>
                <strong>8.4.</strong> Prevádzkovateľ je povinný plniť všetky
                povinnosti vyplývajúce z Nariadenia GDPR a zákona o ochrane
                osobných údajov.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              9. Záverečné ustanovenia
            </h2>
            <div className="space-y-3">
              <p>
                <strong>9.1.</strong> Tieto VOP sa riadia právom Slovenskej
                republiky.
              </p>
              <p>
                <strong>9.2.</strong> Neplatnosť jednotlivého ustanovenia nemá
                vplyv na platnosť zostávajúcej časti VOP.
              </p>
              <p>
                <strong>9.3.</strong> Prevádzkovateľ môže VOP primerane zmeniť,
                najmä pri zmene právnych predpisov, ponuky Služieb,
                prevádzkových / technických podmienok. Zmenu zverejní vopred na
                webovej stránke.
              </p>
              <p>
                <strong>9.4.</strong> Tieto VOP nadobúdajú účinnosť dňom
                1.1.2025.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
