/**
 * Batch seed: 10 pillar blog articles for /blog, scheduled to release
 * biweekly over ~5 months. All seeded as `status: "PUBLISHED"` with a
 * future `publishedAt`. The server-side queries gate visibility with
 * `publishedAt <= now`, so each post automatically appears on its date
 * without a cron job.
 *
 * Topics are inspired by widely-covered barbershop themes (frequency,
 * fades, beard care, etc.) but the content is original, written in our
 * conversational Slovak voice. No cover images — articles render with
 * the built-in scissors fallback until the owner uploads real photos
 * via /admin/blog.
 *
 * Refuses to overwrite existing slugs — safe to re-run after partial
 * failures or for adding new posts in a follow-up pass.
 *
 * Usage:
 *   npx tsx scripts/seed-blog-batch.ts --project=strojcek-production
 *   npx tsx scripts/seed-blog-batch.ts --project=strojcek-staging       # dry-test
 */
import { bootstrapAdminApp } from "./_firebase-bootstrap";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const { projectId } = bootstrapAdminApp();
const db = getFirestore();

// Reading-time mirror of src/lib/reading-time.ts (no alias resolution in
// node scripts).
function computeReadingMinutes(markdown: string): number {
  const plain = markdown.replace(/[#*`_>!\[\]()]/g, " ");
  const words = plain.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// Build a Date at 09:00 Europe/Bratislava on the given calendar day —
// articles "drop" at 9 AM local time, which is a friendly time for
// social posts and a natural moment for users to check the blog. The
// hour is approximated as +02:00 (CEST during the seeded window May-
// October 2026); precise tz isn't critical because the gate is just
// "have we passed this Timestamp yet".
function publishAt(yyyymmdd: string): Date {
  return new Date(`${yyyymmdd}T09:00:00+02:00`);
}

type Article = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  publishedAt: Date;
  content: string;
  /** Path under public/ — null means use the built-in scissors fallback. */
  coverImageUrl: string | null;
  coverImageAlt: string | null;
};

const ARTICLES: Article[] = [
  {
    slug: "ako-casto-chodit-na-strih",
    title: "Ako často chodiť na strih? Sprievodca podľa typu účesu",
    excerpt:
      "Niekto chodí každé 2 týždne, iný 2x ročne — a obaja majú pravdu. Tu je rýchly návod podľa toho aký strih nosíš, ako rýchlo ti rastú vlasy a kedy už účes začne strácať tvar.",
    tags: ["tipy", "starostlivost", "casovanie"],
    publishedAt: publishAt("2026-06-02"),
    coverImageUrl: "/blog/cover-ako-casto-na-strih.svg",
    coverImageAlt: "Vintage kalendár s vyznačeným dátumom strihu",
    content: `Najčastejšia otázka v kresle: **„Tak kedy mám prísť nabudúce?"** Odpoveď nie je univerzálna a viem že čakaš jedno číslo. Skúsim ti to teda rozseknúť podľa typu strihu.

## Krátke pravidlo podľa strihu

- **Fade (akýkoľvek)** — každé **2 až 3 týždne**. Fade je krásny presne preto, že má ostré prechody. Po 3 týždňoch sa stratia a strih vyzerá rozplývajúci. Ak máš skin fade, choď radšej po 2 týždňoch.
- **Klasický pánsky strih, jednotná dĺžka** — **4 až 6 týždňov**. Tu prerast nie je drámou, vlasy si držia tvar dlhšie.
- **Pompadour, quiff, side part s objemom hore** — **3 až 4 týždne**. Vrchná časť rastie a začne padať, kontroluj boky.
- **Buzz cut / number 1-3** — **2 až 4 týždne** podľa toho ako citlivý si na "jeho/jej" účes. Niektorí klienti si to dorážajú strojčekom doma medzi návštevami.
- **Dlhšie vlasy nad goliérom** — **6 až 10 týždňov**. Skôr o údržbe končekov a strapcov než o radikálnej zmene.

## Faktory ktoré tieto čísla posúvajú

- **Ako rýchlo ti rastú vlasy.** Priemer je ~1,3 cm za mesiac, ale niekomu rastie kľudne 2 cm.
- **Hustota.** Hustá kučera maskuje prerast lepšie ako riedkejšie rovné vlasy.
- **Životný štýl.** Pred svadbou / firemnou akciou / na fotenie príď týždeň vopred. Nikdy ne deň pred — vlasy potrebujú "sadnúť".
- **Tvar tváre.** Ak máš výrazné lícne kosti a fade ich zvýrazňuje, oplatí sa chodiť častejšie.

## Pár varovných signálov že už je čas

- Boky sa "tlačia" cez golier
- Brada na fade-i prestáva mať ostrú líniu
- Vlasy hore padajú do očí keď ich pri styling-u poriadne nezatlačíš

Ak vidíš jedno z toho, je čas pristaviť sa.

## Pre-tip: dohodni sa rovno na nasledujúci termín

Najčastejšia situácia ktorú vidíme: zákazník si po strihu povie „nezabudnem si zarezervovať" a nabudúce sa ozve keď je už trochu neskoro. Najjednoduchšie riešenie — **rezervuj si nasledujúci termín hneď po strihu**. Otvor [strojcekbarbershop.sk](/) na telefóne a klikni dátum o 3 týždne. 30 sekúnd a máš vybavené.

Ak váhaš medzi dvoma termínmi, vždy vyber ten skorší. Mierne kratšie už-strihnuté vlasy vyzerajú lepšie ako mierne pre-narastené.

Vidíme sa.

— *Strojček, Bytča*`,
  },

  {
    slug: "starostlivost-o-bradu-doma",
    title: "Starostlivosť o bradu doma: čo robiť každý deň, čo raz týždenne",
    excerpt:
      "Brada nie je iba nechať to rásť. Tu je jednoduchý denný a týždenný systém, ktorý ju udrží zdravú, mäkkú a bez svrbiacej pleti pod ňou. Bez 12 produktov.",
    tags: ["brada", "starostlivost", "tipy"],
    publishedAt: publishAt("2026-06-16"),
    coverImageUrl: "/blog/cover-starostlivost-o-bradu.svg",
    coverImageAlt: "Holiaca štetka a miska na penu — klasický barber set",
    content: `Brada vyzerá najlepšie keď sa o ňu staráš pravidelne, ale **menej znamená viac**. Dvanásť produktov a vyšperkovaný 30-minútový ranný rituál nie sú potrebné. Toto stačí.

## Denne (1-2 minúty)

1. **Umy ju vodou** keď sa sprchuješ. Stačí teplá voda + jemný šampón na bradu (alebo bežný šampón ak nemáš špeciálny — ale **nie sprchový gél**, ten ju vysuší).
2. **Vysuš ručníkom** — nešúchaj agresívne, len pritlač. Mokrá brada + trenie = lámavé chĺpky.
3. **Učeš ju** smerom dole a do tvaru ktorý chceš. Drevený hrebeň alebo špeciálna kefa na bradu, oboje funguje.

To je celé. Nemusíš každý deň "robiť rituál".

## 2-3x do týždňa

**Olej na bradu (beard oil)** — pár kvapiek do dlane, rozotri, vmasíruj **do kože pod bradou**, nie len do chĺpkov. Olej nie je o leskli povrchu, je o tom aby koža pod ňou nebola suchá a nesvrbela. To je príčina #1 prečo ľudia bradu nakoniec oholia — koža svrbí a oni vzdajú.

**Aký olej?** Akýkoľvek dobrý kombinovaný olej (jojoba + arganový + niekoľko esenciálnych) funguje. Nie minerálny olej — ten zacapáva póry.

## Raz týždenne

- **Skontroluj líniu na lícach a krku.** Krk je dôležitý — brada by mala končiť asi 2 cm nad ohryzkom, nie pod ňou. Ak ide až k goliérovej kosti, vyzerá to neupravene.
- **Zarovnaj končeky.** Tu sú nožničky lepšie ako strojček, ak je brada krátka. Pri dlhšej bráde použiješ strojček s nadstavcom — vždy ten istý nadstavec na celej ploche, inak budú dlhšie miesta.

## Čo NIE robiť

- **Holiť pod krkom príliš nízko.** Klasická chyba — pôsobí to ako "double chin". Línia má byť kde sa krk ohýba pri pozeraní rovno.
- **Strihať bradu mokrú.** Mokrá je dlhšia. Strihaj suchú aby si videl reálnu dĺžku.
- **Trhať chĺpky.** Ak rastú "do vnútra" (ingrown), nech ich vyrastie barber, nie pinzeta.

## Kedy prísť do salónu

**Raz za 4-6 týždňov** — formovanie línie krku a líc je práca pre niekoho kto vidí tvoju tvár z odstupu. Doma to spravíš približne, ale brada nemá byť "približne".

V Strojček-u robíme bradu samostatne (~10 min) alebo v kombe so strihom. [Rezervácia online](/) za minútu.

Vidíme sa.`,
  },

  {
    slug: "fade-strih-typy-a-rozdiely",
    title: "Fade strih — typy a rozdiely. Low, mid, high, skin: ktorý si vybrať?",
    excerpt:
      "Fade je najpopulárnejší pánsky strih ostatných rokov, ale „fade“ v skutočnosti znamená 4 rôzne strihy. Tu je rýchly sprievodca podľa toho čo komu sadne.",
    tags: ["fade", "strihy", "tipy"],
    publishedAt: publishAt("2026-06-30"),
    coverImageUrl: "/blog/cover-fade-strihy.svg",
    coverImageAlt: "Otvorené barberské nožnice — klasický nástroj na strih",
    content: `**„Chcel by som fade"** — fajn, ale aký?

Fade je technika postupného prechodu z dlhších vlasov hore do kratších dole, často až do holej kože. Líši sa hlavne tým **ako vysoko prechod začína**. To je celý rozdiel — a zároveň to úplne mení charakter strihu.

## 4 typy fade-u, od najjemnejšieho po najostrejší

### Low fade
Prechod začína nízko, **tesne nad ušami**. Vrchná časť hlavy a väčšina strán ostávajú dlhšie. Najdiskrétnejší fade — vyzerá to ako klasický strih s upraveným kontúrom.

**Komu sadne:** každému. Obzvlášť ak chodíš v košeli a oblek, alebo nemáš na to chodiť k barberovi každé 2 týždne. Low fade rastie najjemnejšie.

### Mid fade
Prechod začína v **strede medzi ušami a temenom**. Stredná cesta — viditeľný kontrast medzi dlhým hore a krátkym dole, ale stále vyvážený.

**Komu sadne:** najuniverzálnejší typ. Ak nevieš ktorý fade, povedz "mid fade" a budeš spokojný.

### High fade
Prechod začína **vysoko, kúsok pod temenom**. Veľký kontrast, výrazný look. Strany sú takmer holé veľmi vysoko.

**Komu sadne:** mladším, atletickým postavám, ľuďom čo majú radi výrazný moderný look. Pri kancelárii v korporáte to môže byť trochu nad rámec dress code-u.

### Skin fade (aka bald fade)
Prechod ide až do **úplne hladkej kože** v dolnej časti. Môže byť low / mid / high skin fade — kombinuje sa s tým kde fade začína.

**Komu sadne:** ak chceš maximálny kontrast a si ochotný chodiť na refresh každé 2 týždne. Po troch týždňoch už skin fade nie je skin fade.

## Špeciálne varianty

- **Taper fade** — najjemnejšia forma, len boky a šíja sú strihané kratšie, nie skutočný "fade do nuly". Klasika.
- **Burst fade** — fade obkresľuje uši v polkruhu, na šíji je dlhší. Trendy s mullet-mi a strihmi s objemom hore.
- **Drop fade** — fade za uchom "padá" nižšie ako vpredu, vytvára pekný oblúk.

## Ako požiadať barbera

Stačia tri veci:
1. **Vysokosť** — low / mid / high
2. **Hĺbka** — skin alebo nie (ak nie, povedz aký nadstavec, napr. „0 hore na fade, 4 hore na temeno")
3. **Variant** — klasický fade vs. burst vs. drop

Príklad: *„Mid skin fade, klasický, hore by som chcel zachovať nejaký objem."*

Ak nevieš čo presne chceš, nevadí — barber sa pozrie a poradí. Ale je dobré vedieť aspoň či chceš viditeľný kontrast (mid/high) alebo decentný (low).

## Údržba

Fade rýchlo prerastá. Plánuj refresh:
- Low fade: 3-4 týždne
- Mid fade: 2-3 týždne
- High / skin fade: 2 týždne

Ak ti to nesedí finančne ani časovo, drž sa pri low fade.

V Strojček-u robíme všetky typy fade-u, väčšinou v rámci pánskeho strihu. [Rezervácia online](/) za minútu.`,
  },

  {
    slug: "priprava-na-svadbu-a-fotenie",
    title: "Príprava na svadbu, fotenie alebo veľký event: timing krok za krokom",
    excerpt:
      "Veľký deň o týždeň a chceš vyzerať najlepšie ako sa dá? Tu je presný timing — kedy ísť k barberovi, čo si nikdy nezariadiť v deň udalosti, a čo dokáže rozhodiť aj dobrý strih.",
    tags: ["svadba", "fotenie", "tipy", "casovanie"],
    publishedAt: publishAt("2026-07-14"),
    coverImageUrl: "/blog/cover-priprava-na-svadbu.svg",
    coverImageAlt: "Klasický motýlik — symbol formálnej príležitosti",
    content: `Veľký event — svadba, krstiny, firemné fotenie, prvý deň v novej práci — má jedno zradné špecifikum: chceš vyzerať najlepšie ako sa dá. A presne preto je to moment kedy ľudia robia najviac chýb.

Tu je timing ktorý fungoval pre desiatky ženíchov v našom kresle.

## 7 dní vopred — strih + brada

**Ideálny moment.** Nie skôr, nie neskôr.

- Vlasy budú vyzerať "sedené" — nie čerstvo strihnuté ako po sušičke, ani prerastené.
- Pri **fade-i** je toto zlatá stredná cesta medzi ostrosťou a prirodzenosťou.
- Brada bude rovnomerne narastená — ak ti barber prirazí líniu, do 7 dní sa krátko obrastie a stratí "ostrý" čerstvý vzhľad.

## 3-4 dni vopred — finálny tvar brady

Ak nosíš bradu a chceš ju ostrú na fotkách, doraz **detail-y** sám. Šijou ohne, lícne línie, drobné asymetrie. Ak na to nemáš oko, **požiadaj barbera o "shape-up"** — krátku 10-minútovú návštevu na úpravu brady (nie celý strih).

## Deň pred — neexperimentuj

**Najväčšia chyba ktorú vidíme:** klient o deň pred svadbou príde s „chcel by som niečo nové, čo by si mi odporučil?" Nie. **Nie.** Veľký deň nie je deň na experiment.

V deň pred:
- Žiadne nové produkty (gél, vosk, pasta) ktoré si predtým neskúšal
- Žiadne radikálne zmeny farby ani strihu
- Brade nedaj nový olej alebo balzam

Ostaň pri tom čo poznáš.

## Deň udalosti — ráno

1. **Spri sa** ako bežne, šampón použi obvyklý
2. **Vysuš vlasy fénom** — neostávaj s vlhkými, padajú do tvaru ktorý neovládneš
3. **Trochu produktu** — menej je viac, fotka zachytí mastné odlesky
4. **Brada:** olej alebo balzam ako bežne, učeš drevenou kefou
5. **Skontroluj v zrkadle z viacerých uhlov** — najmä zboku, lebo fotograf strieľa väčšinou z boku

## Pár vecí ktoré dokážu rozhodiť aj dobrý strih

- **Spánok na pohodlných vankúšoch** — vlasy si "pamätajú" tvar zo spánku. Ak môžeš, satin obliečka.
- **Pot pri uhladenom looku** — pri stresnom dni vezmi si do vrecka **malú vreckovku** na čisté otreťie čela. Žiadne servítky — drhne to pokožku.
- **Klobúk celé doobedie** — vytlačí ti vlasy do podivných tvarov. Ak nosíš čiapku, daj ju len tesne pred kostolom / akciou a nie celé predtým.
- **Plávanie / sauna** — odložiť až na medové týždne.

## Pre celú svadbu — aj svedkov a otca

Ak ste skupina, **dohodnite si v salóne back-to-back termíny v jeden deň, 7 dní pred svadbou**. V Strojček-u to vieme zorganizovať aj v sobotu poobede. [Zavolaj](tel:+421944932871) a dohodneme.

Konzistencia v skupinových fotkách = každý fresh, nie jeden "týždeň po strihu, jeden ne-strihaný".

Vidíme sa pred vaším veľkým dňom.`,
  },

  {
    slug: "etiketa-v-barbershope",
    title: "Etiketa v barbershope: 7 nepísaných pravidiel ktoré by každý mal poznať",
    excerpt:
      "Barbershop nie je formálne miesto, ale má svoju kultúru. Tu je pár vecí, ktoré barberi oceňujú u zákazníkov — a niekoľko ktoré naozaj nemáme radi.",
    tags: ["etiketa", "tipy"],
    publishedAt: publishAt("2026-07-28"),
    coverImageUrl: "/blog/cover-etiketa-v-barbershope.svg",
    coverImageAlt: "Klasický barber pole — ikonický symbol barbershopu",
    content: `Barbershop nie je reštaurácia s michelin hviezdami. Môžeš si vyzliecť bundu, dať si kávu, posedieť, hovoriť o futbale alebo mlčať — všetko fajn.

Ale je tu pár vecí ktoré barberom robia deň ľahší. A pár ktoré naozaj nie.

## 1. Príď načas, alebo 5 minút skôr

**Toto je najdôležitejšie pravidlo.** Náš deň je naplánovaný v 30-45 minútových oknách. Keď meškáš 15 minút, posúvaš každého za sebou.

Ak vieš že nestihneš, **napíš dopredu** ([0944 932 871](tel:+421944932871)). Vďaka 5-minútovému upozorneniu vieme dohodnúť — či počkáš, či presunieme. Bez správy strácaš obaja čas.

## 2. Mobil — buď ticho alebo offline

Hovory počas strihu sú nočná mora pre obe strany:
- Hlavu hýbeš v reakcii na to čo počuješ
- Barber musí pauznúť a čaká
- Strih zaberá 30 % dlhšie

**Najlepšie riešenie:** mobil do vrecka, na vibračku. Ak zazvoní niečo dôležité, ospravedlň sa a vybavovaj von z kresla.

## 3. Vedieť čo chceš — alebo povedať že nevieš

Obe sú v poriadku. Čo nefunguje: *„dajte mi niečo pekné."* To znamená 5 minút otázok kým prídeme k niečomu konkrétnemu.

Lepšie:
- *„Mid fade, hore by som chcel objem"*
- *„Skrátiť o 2 cm, zachovať tvar"*
- *„Neviem čo by mi pasovalo, poraďte"*

Fotka v telefóne na inšpiráciu = jackpot. Žiadne nervy okolo "ja to neviem opísať".

## 4. Sedenie — hlava patrí barberovi

Pri strihu nepozeraj na telefón v lone. Nehýb hlavou. Nezakláňaj sa keď ťa to ťahá zívnuť (alebo si to aspoň naznač).

Najlepšie sedenie: chrbát rovno, hlava v polohe ktorú ti barber dá. On ti ju pohne keď to potrebuje.

## 5. Komunikácia počas strihu

Hovoriť? Mlčať? **Oboje je OK.** Niektoré dni máme náladu na rozhovor, iné dni rád v tichu pracujem. Ty si platíš, takže ty rozhoduješ — ale **drž sa hlavou rovno**, pri rozhovore sa hlava prirodzene hýbe.

## 6. Tipy

Slovensko nie je America — tip nie je povinný. Ale ak si spokojný a chceš poďakovať: **5-15 % je férový rozsah**. Aj 2 € hotovosti je gesto.

Najlepší tip ale nie sú peniaze — je to **vrátenie sa**. Stálych klientov si pamätáme, učíme sa ich preferencie, robíme im to lepšie každú návštevu.

## 7. Hygiena — z obidvoch strán

Z našej strany: čistá zástera, dezinfikované nástroje, papierový obojok. Ak vidíš čokoľvek čo ti nesedí, **povedz** — nikdy sa nebudeme zlostiť.

Z tvojej strany: **príď osprchovaný**, nie ihneď po behu. Suché vlasy strihame lepšie a dlho.

## Bonus: chyby ktoré nás dráždia (ale tichý)

- Čakať na rezerváciu a nedať vedieť 24h pred zrušením (cancellation policy: 2h vopred je minimum, aby sa termín stihol prerozdeliť)
- Priviesť dieťa bez upozornenia ak nemá rezerváciu (priestoru je akurát toľko koľko)
- Pýtať si „o niečo viac kratšie" každé 30 sekúnd, kým barber ide centimeter po centimetri

Nič kataststrofické. Len jemné veci ktoré z bežnej návštevy spravia príjemnejšiu.

Vidíme sa v kresle.`,
  },

  {
    slug: "strih-podla-tvaru-tvare",
    title: "Strih podľa tvaru tváre: čo pasuje guľatej, oválnej a hranatej tvári",
    excerpt:
      "Nie každý strih sedí každému. Tvar tvojej tváre rozhoduje viac ako trendy. Tu je rýchla diagnostika a tipy ktoré strihy pôsobia najlepšie podľa typu tváre.",
    tags: ["strihy", "tipy", "tvarTvare"],
    publishedAt: publishAt("2026-08-11"),
    coverImageUrl: "/blog/cover-tvar-tvare.svg",
    coverImageAlt: "Ručné zrkadlo s ozdobným rámom — vintage barber doplnok",
    content: `Klient príde s fotkou Davida Beckhama a chce presne ten strih. Problém: Beckham má **oválnu tvár**, klient **okrúhlu**. Ten istý strih, dve odlišné výsledky — a klient nechápe prečo to nevyzerá rovnako.

Tvár diktuje strih. Trendy diktujú detail.

## Najprv — aký tvar máš ty?

Postav sa pred zrkadlo, vlasy daj dozadu (na nič ich nevyklikni) a pozri sa rovno.

- **Oválna** — výška tváre približne 1,5x šírka. Brada je o niečo užšia ako čelo. Bez ostrých uhlov.
- **Okrúhla** — výška ≈ šírka, mäkké líca, brada nie je výrazná.
- **Hranatá / štvorcová** — výška ≈ šírka ALE silná ostrá čeľusť a širšie čelo. Pôsobí "blokovito".
- **Pretiahnutá / dlhá** — výška výrazne väčšia ako šírka, čelo + brada sa zužujú.
- **V tvare srdca / heart-shape** — širšie čelo, užšia brada.
- **Diamantová** — najširšie lícne kosti, užšie čelo aj brada.

Ak nie si si istý, **pošli barberovi fotku rovno do telefónu** alebo sa opýtaj v kresle. My vidíme z odstupu lepšie.

## Čo komu pasuje — rýchly cheat sheet

### Oválna tvár
**Najľahší prípad.** Sadne ti takmer čokoľvek. Pompadour, fade, classic side part, mullet, buzz cut — všetko funguje. Volíš podľa štýlu, nie podľa tvaru.

### Okrúhla tvár
Cieľ: **vytvoriť výšku, zúžiť po stranách.**
- ✅ Stredný / vysoký fade, objem hore (pompadour, quiff)
- ✅ Strih s "lift" — zatlačený alebo zafúknutý hore
- ❌ Bowl cut, ploché vrchné vlasy, dlhá ofina cez celú tvár
- ❌ Veľmi dlhé bočné vlasy ktoré stoja von

### Hranatá tvár
Cieľ: **zmäkčiť uhly, ale neprepáliť mužnosť.**
- ✅ Textúrovaný crop, side part s prirodzeným pádom
- ✅ Brada zaoblená dole (nie ostrá)
- ❌ Buzz cut s ostrou hranou na čele (zdvojuje ostrosť)
- ❌ Veľmi vysoký fade s flat-top (zvýrazňuje uhly)

### Pretiahnutá tvár
Cieľ: **pridať šírku, znížiť optickú výšku.**
- ✅ Dlhšie po stranách, kratšie hore
- ✅ Ofina (fringe) ktorá skracuje čelo
- ❌ Pompadour s extrémnym objemom hore (predĺži ešte viac)
- ❌ Veľmi krátke strany — robia tvár ešte dlhšiu

### Heart-shape tvár
Cieľ: **vyvážiť široké čelo a úzku bradu.**
- ✅ Strih ktorý padá cez čelo (mierna ofina)
- ✅ Plnšia brada na zarovnanie spodnej polovice tváre
- ❌ Hladko stiahnuté dozadu (otvára čelo ešte viac)

### Diamantová tvár
Cieľ: **pridať šírku k čelu, zúžiť lícne kosti.**
- ✅ Plnšie vlasy hore a po stranách v hornej polovici
- ✅ Krátka klasická brada ktorá rozšíri spodok
- ❌ Vysoký fade ktorý zvýrazní široké lícne kosti

## Brada — druhá premenná

Brada vie tvár opticky **predĺžiť** (ostrá línia, dlhšia brada) alebo **rozšíriť** (plnšia, kratšia).

Príklad: ak máš okrúhlu tvár a nosíš plnú okrúhlu bradu, znásobíš okrúhlosť. Lepšia voľba: krátka ostrá brada s mierne dlhšou bradou pod bradou (predĺži tvár).

## Praktický postup

1. **Zisti tvar tváre** (zrkadlo + porovnanie vyššie)
2. **Vyber primárnu stratégiu** (pridať výšku / zúžiť strany / zmäkčiť uhly)
3. **Konzultuj s barberom** — povedz mu tvar tváre a stratégiu, nech navrhne konkrétny strih

V Strojček-u robíme konzultáciu zdarma. Príď, sadni do kresla, pozriem ti na tvár 30 sekúnd a poviem ti čo skúsiť. [Rezervácia online](/).`,
  },

  {
    slug: "buzz-cut-minimalisticka-klasika",
    title: "Buzz cut: minimalistická klasika, ktorá nikdy nezostarne",
    excerpt:
      "Najkratší strih, najmenej údržby, najväčší statement. Buzz cut nie je iba „dať si to dole“ — je to design choice. Tu je čo o ňom musíš vedieť pred prvým kreslom.",
    tags: ["buzz-cut", "strihy", "klasika"],
    publishedAt: publishAt("2026-08-25"),
    coverImageUrl: "/blog/cover-buzz-cut.svg",
    coverImageAlt: "Profesionálny strihací strojček — nástroj na buzz cut",
    content: `Buzz cut má povesť strihu pre "lenivých" alebo "tých čo prehrávajú boj s vlasmi". Realita: je to **najselektívnejší strih po pompadúre**. Buzz cut buď padne dokonale, alebo vôbec.

Tu je čo zvážiť pred tým ako sa rozhodneš.

## Čo je buzz cut

Strih s rovnomernou dĺžkou po celej hlave, robený strojčekom. Nadstavec určuje dĺžku — typicky **number 1 až number 4**:

- **Number 0 (0 mm)** — skin, holá koža
- **Number 1 (3 mm)** — induction cut, hrubá štetina
- **Number 2 (6 mm)** — krátky ale viditeľný
- **Number 3 (9 mm)** — najbežnejší, "praktický" buzz
- **Number 4 (12 mm)** — krátky crop, už menej "buzz" a viac "very short cut"

## Komu sadne

### Áno, ak máš:
- **Oválnu alebo hranatú tvár** — buzz cut zvýrazní čeľusť, ktorá tu pôsobí dobre
- **Husté vlasy** — sila a husota sa pri buzze ukáže ako vyhotovenie
- **Symetrickú lebku** — nezakrýva nič, takže každá nepravidelnosť je viditeľná
- **Sebavedomé držanie tela** — buzz potrebuje energiu, nie tichú prítomnosť

### Premysli si, ak máš:
- **Veľmi okrúhlu tvár** — zvýrazní okrúhlosť
- **Asymetrickú lebku** alebo jazvy ktoré nemáš rád
- **Veľmi tenké / riedke vlasy** — môže byť super (zakryje plešatenie) alebo zlé (zvýrazní ho)
- **Heart-shape tvár** — môže prepáliť pomer čela a brady

## Ako sa rozhodnúť

**Krok 1:** Pozri si fotky známych ľudí s tvojím tvarom tváre v buzz cute. Idris Elba (oválna), Jason Statham (mierne hranatá), Pitbull (okrúhla — všimni si ako mu funguje s plnou bradou).

**Krok 2:** Skús to "skoro buzz" — number 4. Ak sa ti to páči, choď nižšie. Toto je strih ktorý sa NEDAJÚ vrátiť — vlasy musia narásť späť (cca 6 mesiacov na 5 cm).

**Krok 3:** Buzz cut funguje **najlepšie s plnou alebo strednou bradou**. Holá tvár + buzz cut = "vojak". S bradou = "Statham vibe".

## Údržba — najnižšia zo všetkých strihov

- **Sušenie:** uterák, hotovo (5 sekúnd)
- **Styling:** nepotrebný
- **Produkt:** žiadny
- **Návšteva barbera:** každé 2-4 týždne, podľa toho ako rýchlo rastieš

**Pre-tip:** kúp si vlastný strojček (Wahl alebo Andis, ~80€) a doraz si to medzi návštevami sám. Ušetríš ~20 € mesačne.

## Pozor na pokožku

Buzz cut odhaľuje **skalp**. Suchá / mastná / s lupinami pokožka zrazu vidieť. Pridaj 2 veci do rituálu:

1. **Hydratačný balzam** (alebo bežný telový krém) na skalp 1x denne — najmä v zime
2. **SPF na hlavu** v lete — slnečný úpal cez 3mm "vlasov" je realita, nie vtip

## Záver

Buzz cut je **najjednoduchší strih s najťažším rozhodnutím**. Trvá 10 minút, vydrží 3 týždne, mení tvoj výzor podstatne.

Ak ho zvažuješ, **príď na konzultáciu**. V Strojček-u sa pozrieme, zhodnotíme tvar lebky + tváre, povieme ti úprimne či to bude fungovať. Žiadny "predaj" — radšej ti to odhovoríme keď nesedí, než aby si vyšiel von s niečím čo neoľutuješ.

[Rezervácia online](/) za minútu.`,
  },

  {
    slug: "brada-a-strih-ako-zladit",
    title: "Brada a strih: ako ich zladiť aby tvár vyzerala harmonicky",
    excerpt:
      "Brada a vlasy sú dva nezávislé prvky, ale tvár ich vníma ako jeden celok. Tu je ako ich zladiť tak aby dohromady fungovali — bez kompromisu na štýle.",
    tags: ["brada", "strih", "tipy"],
    publishedAt: publishAt("2026-09-08"),
    coverImageUrl: "/blog/cover-brada-a-strih.svg",
    coverImageAlt: "Klasická otvorená britva — straight razor",
    content: `Vlasy a brada si "vymieňajú správy" cez tvoju tvár. Keď nesúhlasia, tvár pôsobí rozhádaná — aj keď sú jednotlivo oba dobré.

Tu sú tri princípy ktoré používame v Strojček-u keď klient prichádza s "novou" bradou alebo strihom a nevie ako to skombinovať.

## Princíp 1: dĺžková rovnováha

Pravidlo palca: **brada by mala mať polovicu až dve tretiny dĺžky vlasov hore.**

- Vlasy 4 cm hore → brada ~2-3 cm
- Vlasy buzz cut (0,5 cm) → brada krátka stubble (0,5-1 cm)
- Vlasy dlhšie (10 cm) → brada strednej dĺžky (4-6 cm)

Extrémny príklad nesúladu: **buzz cut + plná dlhá brada** — funguje len pre niektoré tváre (typický "lumberjack" look) a vyžaduje sebavedomé držanie. Klasická "bezpečná" rovnováha je proporciálna.

## Princíp 2: fade na strane = fade brady

Ak máš fade v strihu, **brada by mala mať fade tiež** — postupný prechod medzi líniou tváre a vlasmi. Bez fade-u brady tvoríš ostrú "linku" medzi vlasmi a bradou, ktorá zvýrazňuje akúkoľvek asymetriu.

Ako sa to robí: barber pri strihu **pokračuje fade-om do brady na lícach**, čím vznikne plynulý prechod od skin (0 mm) cez 1-2-4 mm až do plnej dĺžky brady. Tomu sa hovorí **"connected fade"** alebo "beard line tie-in".

Ak máš klasický strih (bez fade-u), brada ostáva s ostrejšou líniou — to je v poriadku, klasika so klasikou si tyká.

## Princíp 3: textúra hovorí s textúrou

- **Textúrovaný strih** (crop, messy quiff, modern fringe) ide najlepšie s **textúrovanou bradou** — nie napalemo zarovnanou pinzetou, ale prirodzene tvarovanou s mierne nesymetrickými okrajmi.
- **Klasický strih** (side part, slick back, classic taper) chce **hladkú, ostrú, presne tvarovanú bradu** s rovnou líniou na lícach.

Mismatch: ostrý slick back + chaotická "huba" brada = "kombinácia z dvoch ľudí".

## Konkrétne kombinácie ktoré fungujú

### "Boss" look
- Vlasy: pompadour s fade-om
- Brada: krátka, plne tvarovaná, s connected fade

### "Modern minimalist"
- Vlasy: low fade s krátkym crop-om hore
- Brada: krátka stubble (1-2 mm), ostrá línia krku

### "Rugged"
- Vlasy: medium length, mierne textúrované
- Brada: plnšia (4-6 cm), prirodzená línia s decentným tvarovaním

### "Clean classic"
- Vlasy: side part bez fade-u
- Brada: holá tvár alebo 5-day stubble (nič medzi)

## Čo NIE robiť

- **Brada bez línie** — aj 1mm stubble má mať líniu na krku. Bez nej to vyzerá zanedbane.
- **Brada širšia než vlasy hore** — pridáva tvári "ťažkosť" v spodnej polovici, najmä u hranatých tvárí.
- **Holá tvár + super dlhé vlasy** — ak nie si naozaj mladý, zvážiš aspoň pár dní strniska.

## Pri novej zmene — choď na obe naraz

Najlepší výsledok dostaneš keď **strih + brada robíme v jeden termín**. Vidím tvár ako celok, viem fade lícne línie a fade strihu zjednotiť, brada padne presne tam kde má.

Oddelené návštevy fungujú, ale často musíš vracať lebo "niečo nesedí" — pri kombinácii sa všetko vyladí raz.

V Strojček-u máme **kombo strih + brada** v jednom slot-e. [Rezervácia online](/) za minútu.`,
  },

  {
    slug: "ako-udrzat-strih-cerstvy",
    title: "Ako udržať strih čerstvý čo najdlhšie? 8 praktických tipov",
    excerpt:
      "Vyšiel si z kresla, vyzeráš dobre. O 7 dní to už nie je „čerstvé“. Tu je pár habits ktoré predĺžia ten „fresh cut“ feeling minimálne o týždeň.",
    tags: ["tipy", "starostlivost", "udrzba"],
    publishedAt: publishAt("2026-09-22"),
    coverImageUrl: "/blog/cover-udrziavanie-strihu.svg",
    coverImageAlt: "Klasický barberský hrebeň s hrubými a jemnými zubami",
    content: `Strih vydrží "čerstvý" v priemere 7-10 dní pri fade-i a 14-21 dní pri klasike. **Ale ten range znamená rozdiel medzi „vyzerá ako včera" a „už by som mal ísť".**

Päť rokov našich zákazníkov ma naučilo že to nie je o produktoch. Je to o návykoch.

## 1. Umy vlasy správnym šampónom, ale nie každý deň

**Najčastejší omyl:** denné umývanie šampónom. Šampón odstraňuje aj prirodzené oleje skalpu, ktoré dávajú vlasom prirodzený lesk a hold.

**Lepšie:** šampón 2-3x do týždňa, ostatné dni len **teplá voda** (alebo conditioner-only ak máš dlhšie).

Šampón nech je **sulfátov-free** (na obale: "sulfate-free" alebo bez SLS / SLES) — bežné drogériové šampóny sú zbytočne agresívne pre denný strih.

## 2. Suš vlasy fénom, nie ručníkom dohola

**Mokré vlasy "zaspia" do tvaru ktorý si ti dal sušič / ručník.** Trenie ručníkom na sucho = zmrvený výsledok ako čo sa zobudíš.

Lepšie:
1. **Pritlač** ručník — vysuš na 70 %
2. **Vysuš fénom** na strednej teplote v smere ktorý chceš (nie hlavou dole, nie agresívne hore)
3. **Vystavi 30 sekúnd studenej fáze** — zatvorí kutikulu, vlasy budú lesklé a držať tvar

## 3. Menej produktu, ale produkt správny

**Veľa muzeálovho produktu = ťažšie vlasy = padajú do tvaru ktorý nechceš.** Skús polovicu toho čo používaš teraz.

Pre väčšinu pánskych strihov:
- **Krátky strih (fade, crop):** **pomáda** alebo **paste** v lentilkovej veľkosti
- **Stredný (pompadour, quiff):** **hair clay** v menšej lieskovej veľkosti
- **Dlhší:** **matte sea salt spray** + len pár fúkov

**Klasická chyba:** gél na týždeň starý fade. Gél stuhne, ukáže každý lupený detail.

## 4. Vankúš a spánok

Bavlnená obliečka = trenie + statická elektrika = vlasy do podivných tvarov ráno.

**Riešenie:**
- **Satin / hodvábna obliečka** (~20 € na Aliexpresse, vydrží roky)
- **Spi na chrbte** ak vieš (chápem že je to ťažké)
- **Ráno len trochu nafúkaj fénom + chladný studený výfuk** — strih sa "spamätá"

## 5. Pravidelná home-touch línia krku a okolo uší

**Toto je secret sauce.** Po 10 dňoch od strihu sa fade rozplýva najmä na **spodnej hrane na šíji** a **okolo uší**. Tieto dve zóny si môžeš doraziť doma.

Postup:
- Strojček bez nadstavca (skin) alebo s 0,5 nadstavcom
- Skontroluj v zrkadle z dvoch strán
- **Len holé miesta**, nikdy nezachádzaj nahor do fade-u (zničíš prácu barbera)

Týmto si predĺžiš "čerstvý" vzhľad o ďalší týždeň.

## 6. Brada a strih navzájom

Ak máš bradu, **udržuj líniu krku a líc denne**. Plne narastená brada s neudržanou líniou vyzerá zanedbane a "pošpiní" aj dobrý strih.

Investícia: malý precision trimmer (~30 €). Trvá 2 minúty každé ráno.

## 7. Klobúky a beanies — opatrne

Klobúk celé doobedie = vlasy splaštené do podivných tvarov. Dva tipy:
- **Beanie dávaj len keď je naozaj zima**, nie len pre style
- **Pri doľahnutí domov nech vlasy oddychnú 10 min** — sa "vrátia" do tvaru

## 8. Pravidelnosť > marathony

**Najdôležitejší tip zo všetkých:** plánuj refresh včas. Žiadna kombinácia produktov nezachráni 5-týždňový fade ktorý mal byť pred 2 týždňami.

Strih → 7 dní → kontrola → 14 dní → kontrola → 21 dní → barbershop. Predvídateľný rytmus.

V Strojček-u si môžeš pri odchode rovno rezervovať ďalší termín. Alebo to vybavíš zo mobilu — [strojcekbarbershop.sk](/) → 60 sekúnd.

Vidíme sa.`,
  },

  {
    slug: "top-chyby-v-domacej-starostlivosti",
    title: "Top 7 chýb pri domácej starostlivosti o vlasy a bradu (a ako ich opraviť)",
    excerpt:
      "Niektoré chyby robíš každý deň a netušíš o tom. Tu je 7 najčastejších omylov ktoré vidíme v salóne — od umývania až po sušenie — a praktické fix-y na každú.",
    tags: ["chyby", "starostlivost", "tipy"],
    publishedAt: publishAt("2026-10-06"),
    coverImageUrl: "/blog/cover-chyby-v-starostlivosti.svg",
    coverImageAlt: "Vintage apothecary fľaštička s tonikom alebo olejom",
    content: `Väčšina chýb v starostlivosti o vlasy a bradu nie je z lenivosti. Je z dobrých úmyslov **doplnených o zlú informáciu z drogérie alebo TikToku**.

Tu je ako to ide vidieť z barberskej stoličky.

## 1. Umývaš vlasy príliš často

**Bežná predstava:** "viac umývať = čistejšie + lepšie."
**Realita:** denné umývanie šampónom vysušuje pokožku hlavy, ktorá kompenzuje **väčšou produkciou mazu** → vlasy sú za pár hodín mastné → umyješ znova → začarovaný kruh.

**Fix:** šampón 2-3x do týždňa. Medzi tým len teplá voda (alebo conditioner-only).

## 2. Drhnutie ručníkom

**Bežná predstava:** "treba poriadne vysušiť, aby som nebol mokrý."
**Realita:** mokré vlasy sú v najzraniteľnejšom stave. Drhnutie spôsobuje **lámanie** a **statickú elektrinu** ktorá ich zaspláva do podivných tvarov.

**Fix:** **pritlač** ručník bez trenia. Mokré vlasy doschnú fénom alebo air-dry-om. Pre bradu to platí dvojnásobne — chĺpky brady sú hrubšie a krehnejšie.

## 3. Príliš veľa produktu, alebo zlý produkt

**Bežná predstava:** "viac gélu / pomády = lepší hold."
**Realita:** ťažký produkt **stiahne vlasy dole** a ukáže každý detail. Po 4 hodinách máš mastné a oslabené vlasy.

**Fix:**
- Krátky strih: pomáda **vo veľkosti šošovice**
- Stredný strih: clay **vo veľkosti hrachu**
- Dlhý: sea salt spray, 3 fúk-y

A nikdy nepoužívaj produkt na **mokré vlasy** ak nie je vyslovene leave-in conditioner. Suč najprv vlasy na 70 %, potom produkt, potom doraz fénom.

## 4. Strihanie brady mokrú

**Bežná predstava:** "vidím tvar lepšie keď je vyčesaná a mokrá."
**Realita:** mokrá brada je až **o 30 % dlhšia** ako suchá. Zostriehol si "akurátne" → suchá je o 1 cm kratšia ako si chcel → vyzerá zanedbane.

**Fix:** **brada sa strihá suchá**. Vyčesaná, ale suchá. Mokrá iba ak chceš ostrú definovanú líniu (a aj vtedy len v posledných 30 sek).

## 5. Domáci pokus o fade

**Bežná predstava:** "videl som video, dokážem si to."
**Realita:** fade je 8-12 jemných prechodov na 4 cm priestoru, robených s 5-6 rôznymi nadstavcami a clipper-over-comb technikou. **YouTube ti to neukáže reálne.**

**Fix:** doma si vieš **udržiavať to čo už máš** — line-up na krku a okolo uší, ne-vytvárať fade od nuly. Plný fade nech robí niekto kto má za sebou 200 hláv praxe.

## 6. Ignorovanie pokožky pod bradou

**Bežná predstava:** "brada = chĺpky, pokožka je pod tým, nevidím ju."
**Realita:** suchá pokožka pod bradou je príčina #1 prečo ľudia bradu nakoniec oholia. **Svrbenie, šupinky, červené plochy** — všetko sa dá riešiť.

**Fix:** beard oil **vmasírovaný do kože**, nie do chĺpkov. 3-5 kvapiek, prsty cez bradu **až na pokožku**, krúživý pohyb 30 sekúnd. 3x do týždňa.

## 7. Žiadne SPF na hlavu (najmä pri buzz cute a riedkych vlasoch)

**Bežná predstava:** "vlasy ma chránia pred slnkom."
**Realita:** 3mm vlasov nie sú UV štít. **Skalp horí najrýchlejšie zo všetkých miest na tele** — najviac vystavený, najmenej tieň.

**Fix:** v lete SPF spray na skalp (existujú špeciálne, alebo bežný spray pre lokálne použitie). Alebo klobúk / šiltovka pri dlhom pobyte vonku.

## Bonus chyby ktoré sme vynechali:

- **Veľa horúcej vody pri umývaní** — vysušuje pokožku. Vlažná je lepšia.
- **Striháš si vlasy doma 2 dni pred dôležitou udalosťou** — vždy zlyhanie. Plánuj 7 dní vopred.
- **Žiadny conditioner ak máš dlhšie vlasy** — bez conditioner-u sú konce krehnejšie a ľahšie sa lámu.

## Premyslené zhrnutie

Väčšina starostlivosti = **menej, ale lepšie**. Drahá rutina s 10 produktami nie je lepšia ako lacná rutina s 3 produktami zvolenými správne.

Ak chceš osobnú konzultáciu na to **čo robíš dobre a čo by si mohol zmeniť**, prídi do salónu. Pri každom strihu sa rád spýtam aký produkt používaš a ako si umývaš vlasy — vieme ti to za 2 minúty preladiť.

[Rezervácia online](/) za minútu.`,
  },
];

async function main() {
  console.log(
    `\nSeeding ${ARTICLES.length} blog articles to ${projectId}.\n`
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const article of ARTICLES) {
    const ref = db.doc(`blogPosts/${article.slug}`);
    const readingMinutes = computeReadingMinutes(article.content);

    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists) {
          skippedCount++;
          console.log(
            `  ⏭  blogPosts/${article.slug} already exists — skipped.`
          );
          return;
        }
        const now = Timestamp.now();
        tx.set(ref, {
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          coverImageUrl: article.coverImageUrl,
          // null — these covers live in public/blog, not Firebase Storage,
          // so there's nothing to clean up on replace/delete.
          coverImagePath: null,
          coverImageAlt: article.coverImageAlt,
          tags: article.tags,
          status: "PUBLISHED",
          readingMinutes,
          publishedAt: Timestamp.fromDate(article.publishedAt),
          createdAt: now,
          updatedAt: now,
        });
        createdCount++;
        console.log(
          `  ✔  blogPosts/${article.slug}  →  releases ${article.publishedAt
            .toISOString()
            .slice(0, 10)} (${readingMinutes} min read)`
        );
      });
    } catch (err) {
      console.error(`  ✗  blogPosts/${article.slug} failed:`, err);
    }
  }

  console.log(
    `\nDone — created ${createdCount}, skipped ${skippedCount} on ${projectId}.`
  );
  console.log(
    `Articles release biweekly. The earliest goes live at ${ARTICLES[0].publishedAt.toISOString()}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
