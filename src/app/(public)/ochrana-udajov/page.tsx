import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Ochrana osobných údajov — Strojček",
  description:
    "Zásady ochrany osobných údajov pre online rezervácie v barbershope Strojček",
};

export default function OchranaUdajovPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Link
          href="/book"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" />
          Späť na rezerváciu
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Ochrana osobných údajov
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Zásady spracúvania osobných údajov podľa Nariadenia GDPR
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90">
          {/* Section 1 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              1. Prevádzkovateľ osobných údajov
            </h2>
            <div className="space-y-3">
              <p>
                Prevádzkovateľom osobných údajov v zmysle Nariadenia Európskeho
                parlamentu a Rady (EÚ) 2016/679 o ochrane fyzických osôb pri
                spracúvaní osobných údajov (ďalej len{" "}
                <strong>&ldquo;GDPR&rdquo;</strong>) a zákona č. 18/2018 Z. z.
                o ochrane osobných údajov je:
              </p>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
                <p>
                  <strong>STROJČEK s.r.o.</strong>
                </p>
                <p>Moyzesova 379/2, Bytča</p>
                <p>IČO: 57286477</p>
                <p>DIČ: 2122649100</p>
                <p>
                  E-mail:{" "}
                  <a
                    href="mailto:strojcekbarbershop@gmail.com"
                    className="text-primary underline underline-offset-2"
                  >
                    strojcekbarbershop@gmail.com
                  </a>
                </p>
                <p>
                  Tel.:{" "}
                  <a
                    href="tel:+421944932871"
                    className="text-primary underline underline-offset-2"
                  >
                    +421 944 932 871
                  </a>
                </p>
              </div>
              <p>
                (ďalej len <strong>&ldquo;Prevádzkovateľ&rdquo;</strong>)
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              2. Rozsah spracúvaných osobných údajov
            </h2>
            <div className="space-y-3">
              <p>
                Prevádzkovateľ spracúva len osobné údaje nevyhnutné na
                poskytnutie služieb online rezervácie:
              </p>
              <ul className="list-disc space-y-1.5 pl-6">
                <li>meno a priezvisko,</li>
                <li>telefónne číslo,</li>
                <li>e-mailová adresa,</li>
                <li>
                  poznámka k rezervácii (ak ju Zákazník dobrovoľne uvedie).
                </li>
              </ul>
              <p>
                Prevádzkovateľ nespracúva žiadne zvláštne kategórie osobných
                údajov (citlivé údaje).
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              3. Účel spracúvania osobných údajov
            </h2>
            <div className="space-y-3">
              <p>
                Osobné údaje Zákazníka sú spracúvané na nasledovné účely:
              </p>
              <ul className="list-disc space-y-1.5 pl-6">
                <li>
                  spracovanie a evidencia rezervácií termínov služieb,
                </li>
                <li>
                  zasielanie potvrdení o vytvorení, zmene alebo zrušení
                  rezervácie (e-mail, SMS),
                </li>
                <li>
                  zasielanie pripomienok pred blížiacim sa termínom rezervácie,
                </li>
                <li>
                  komunikácia so Zákazníkom v súvislosti s rezerváciou (napr.
                  zmena termínu zo strany Prevádzkovateľa),
                </li>
                <li>
                  plnenie zákonných povinností Prevádzkovateľa (účtovné
                  a daňové predpisy).
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              4. Právny základ spracúvania
            </h2>
            <div className="space-y-3">
              <p>
                Osobné údaje sú spracúvané na základe nasledovných právnych
                základov:
              </p>
              <ul className="list-disc space-y-1.5 pl-6">
                <li>
                  <strong>
                    Plnenie zmluvy (čl. 6 ods. 1 písm. b) GDPR):
                  </strong>{" "}
                  spracúvanie je nevyhnutné na plnenie zmluvy o poskytnutí
                  služby, ktorej zmluvnou stranou je Zákazník, resp. na
                  vykonanie opatrení pred uzavretím zmluvy na základe žiadosti
                  Zákazníka (vytvorenie rezervácie).
                </li>
                <li>
                  <strong>
                    Oprávnený záujem (čl. 6 ods. 1 písm. f) GDPR):
                  </strong>{" "}
                  zasielanie pripomienok o blížiacom sa termíne rezervácie, čím
                  sa predchádza situáciám nedostavenia sa (No-show) a zvyšuje sa
                  kvalita služieb pre všetkých zákazníkov.
                </li>
                <li>
                  <strong>
                    Plnenie zákonnej povinnosti (čl. 6 ods. 1 písm. c) GDPR):
                  </strong>{" "}
                  spracúvanie na účely splnenia účtovných a daňových povinností.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              5. Príjemcovia osobných údajov
            </h2>
            <div className="space-y-3">
              <p>
                Osobné údaje Zákazníka môžu byť poskytnuté nasledovným
                príjemcom výlučne v rozsahu nevyhnutnom na plnenie účelu
                spracúvania:
              </p>
              <ul className="list-disc space-y-1.5 pl-6">
                <li>
                  <strong>Poskytovateľ e-mailových služieb (Resend)</strong> —
                  na zasielanie potvrdení a pripomienok o rezerváciách
                  prostredníctvom e-mailu.
                </li>
                <li>
                  <strong>Poskytovateľ SMS služieb</strong> — na zasielanie SMS
                  potvrdení a pripomienok o rezerváciách.
                </li>
              </ul>
              <p>
                S týmito poskytovateľmi má Prevádzkovateľ uzavreté zmluvy
                o spracúvaní osobných údajov v súlade s čl. 28 GDPR.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              6. Doba uchovávania osobných údajov
            </h2>
            <div className="space-y-3">
              <p>
                Osobné údaje Zákazníka sú uchovávané po dobu{" "}
                <strong>12 mesiacov</strong> od dátumu poslednej rezervácie.
                Po uplynutí tejto doby sú údaje vymazané, pokiaľ ich
                uchovávanie nie je vyžadované právnymi predpismi (napr.
                účtovné doklady po dobu stanovenú zákonom o účtovníctve).
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              7. Práva dotknutej osoby
            </h2>
            <div className="space-y-3">
              <p>
                Zákazník má ako dotknutá osoba v zmysle GDPR nasledovné práva:
              </p>
              <ul className="list-disc space-y-1.5 pl-6">
                <li>
                  <strong>Právo na prístup (čl. 15 GDPR):</strong> právo
                  získať potvrdenie o tom, či sa spracúvajú osobné údaje, ktoré
                  sa ho týkajú, a ak tomu tak je, získať prístup k týmto
                  údajom.
                </li>
                <li>
                  <strong>Právo na opravu (čl. 16 GDPR):</strong> právo na
                  opravu nesprávnych osobných údajov alebo na doplnenie
                  neúplných údajov.
                </li>
                <li>
                  <strong>Právo na vymazanie (čl. 17 GDPR):</strong> právo
                  požiadať o vymazanie osobných údajov, ak pominul účel ich
                  spracúvania alebo ak Zákazník namieta proti spracúvaniu.
                </li>
                <li>
                  <strong>
                    Právo na obmedzenie spracúvania (čl. 18 GDPR):
                  </strong>{" "}
                  právo požiadať o obmedzenie spracúvania osobných údajov
                  v prípadoch stanovených GDPR.
                </li>
                <li>
                  <strong>
                    Právo na prenosnosť údajov (čl. 20 GDPR):
                  </strong>{" "}
                  právo získať osobné údaje v štruktúrovanom, bežne používanom
                  a strojovo čitateľnom formáte.
                </li>
                <li>
                  <strong>Právo namietať (čl. 21 GDPR):</strong> právo
                  namietať proti spracúvaniu osobných údajov vykonávanému na
                  základe oprávneného záujmu Prevádzkovateľa.
                </li>
              </ul>
              <p>
                Svoje práva môže Zákazník uplatniť zaslaním žiadosti na e-mail:{" "}
                <a
                  href="mailto:strojcekbarbershop@gmail.com"
                  className="text-primary underline underline-offset-2"
                >
                  strojcekbarbershop@gmail.com
                </a>
                . Prevádzkovateľ vybaví žiadosť bez zbytočného odkladu,
                najneskôr do 30 dní od jej doručenia.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              8. Právo podať sťažnosť
            </h2>
            <div className="space-y-3">
              <p>
                Ak sa Zákazník domnieva, že spracúvanie jeho osobných údajov je
                v rozpore s GDPR alebo zákonom o ochrane osobných údajov, má
                právo podať sťažnosť dozornému orgánu:
              </p>
              <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
                <p>
                  <strong>Úrad na ochranu osobných údajov Slovenskej
                  republiky</strong>
                </p>
                <p>Hraničná 12, 820 07 Bratislava 27</p>
                <p>
                  Web:{" "}
                  <a
                    href="https://dataprotection.gov.sk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    dataprotection.gov.sk
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              9. Automatizované rozhodovanie a profilovanie
            </h2>
            <div className="space-y-3">
              <p>
                Prevádzkovateľ nevykonáva žiadne automatizované rozhodovanie
                ani profilovanie v zmysle čl. 22 GDPR. Osobné údaje Zákazníka
                nie sú predmetom automatizovaného individuálneho rozhodovania.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              10. Súbory cookies
            </h2>
            <div className="space-y-3">
              <p>
                Webová stránka Prevádzkovateľa nepoužíva žiadne analytické,
                reklamné ani sledovacie súbory cookies. Používané sú výlučne
                technicky nevyhnutné cookies potrebné na správne fungovanie
                webovej stránky a online rezervačného systému (napr. cookies
                relácie pre prihlásenie). Tieto cookies nepodliehajú súhlasu
                v zmysle čl. 5 ods. 3 smernice 2002/58/ES (ePrivacy).
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              11. Prenos údajov do tretích krajín
            </h2>
            <div className="space-y-3">
              <p>
                Prevádzkovateľ neprenáša osobné údaje Zákazníka do krajín mimo
                Európskeho hospodárskeho priestoru (EHP). Všetky údaje sú
                spracúvané a uchovávané na serveroch v rámci EÚ/EHP.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              12. Bezpečnosť osobných údajov
            </h2>
            <div className="space-y-3">
              <p>
                Prevádzkovateľ prijal primerané technické a organizačné
                opatrenia na ochranu osobných údajov pred neoprávneným
                prístupom, stratou, zničením alebo zneužitím, a to najmä:
              </p>
              <ul className="list-disc space-y-1.5 pl-6">
                <li>
                  šifrovanie komunikácie medzi webovou stránkou a serverom
                  (HTTPS/TLS),
                </li>
                <li>
                  riadenie prístupu k osobným údajom (prístup majú len
                  oprávnené osoby),
                </li>
                <li>
                  zabezpečenie databázy heslami a šifrovaním,
                </li>
                <li>
                  pravidelné zálohovanie údajov.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              13. Záverečné ustanovenia
            </h2>
            <div className="space-y-3">
              <p>
                Tieto zásady ochrany osobných údajov sú platné a účinné od
                1.1.2025. Prevádzkovateľ si vyhradzuje právo tieto zásady
                primerane aktualizovať, najmä pri zmene právnych predpisov
                alebo zmene rozsahu poskytovaných služieb. Aktuálne znenie je
                vždy dostupné na webovej stránke Prevádzkovateľa.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
