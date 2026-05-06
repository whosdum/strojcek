export interface ServiceContent {
  slug: string;
  name: string;
  metaDescription: string;
  intro: string;
  forWhom: string[];
  howItWorks: string[];
  whyUs: string;
  durationLabel: string;
  relatedSlugs: string[];
}

export const SERVICES: ServiceContent[] = [
  {
    slug: "pansky-strih",
    name: "Klasický pánsky strih",
    metaDescription:
      "Klasický pánsky strih v Bytči — Strojček. Strih nožnicami aj strojčekom, umytie vlasov, styling. Online rezervácia za 60 sekúnd.",
    intro:
      "Klasický pánsky strih je základ. Strih nožnicami a strojčekom prispôsobený tvaru tváre, typu vlasov a štýlu, ktorý chcete nosiť. U nás v Bytči to nie je rutinný úkon — začíname konzultáciou, dohodneme sa na dĺžke aj prechodoch, a každý strih ladíme tak, aby vám sedel aj o pár týždňov, keď trochu narastie.",
    forWhom: [
      "Pánov, ktorí chcú stálu, čistú podobu vlasov",
      "Kto chce strih, ktorý drží 4–6 týždňov bez podstrihovania",
      "Pánov, ktorí hľadajú nový vzhľad a uvítajú odporúčanie barbera",
    ],
    howItWorks: [
      "Konzultácia — typ vlasov, životný štýl, obľúbená dĺžka",
      "Umytie vlasov a krátka masáž pokožky hlavy",
      "Strih nožnicami v hornej časti, strojček po stranách",
      "Dotvarovanie line-up a kontúry britvou",
      "Styling — voskom, gélom alebo bez (podľa vašej preferencie)",
    ],
    whyUs:
      "Robíme to, čo si zákazníci pochvaľujú — presné prechody, čisté kontúry a styling, ktorý vydrží. Pracujeme s profesionálnymi strojčekmi a kvalitnou pánskou kozmetikou.",
    durationLabel: "30–45 minút",
    relatedSlugs: ["fade-strih", "strojcek-ritual"],
  },
  {
    slug: "fade-strih",
    name: "Fade strih",
    metaDescription:
      "Fade strih v Bytči — low, mid, high aj skin fade. Plynulé prechody, detailná práca strojčekom a britvou. Rezervujte si termín online.",
    intro:
      "Fade strih je o presnom prechode od kratšej dĺžky pri pokožke k dlhšej hore. Robíme všetky varianty — low fade (prechod začína nízko nad uchom), mid fade (uprostred), high fade (vyššie pri spánku) aj skin fade, kde prejdeme až na pokožku. Pre detailnú prácu používame strojček aj britvu — fade musí byť plynulý, žiadne viditeľné línie.",
    forWhom: [
      "Trendovo zameraných pánov, ktorí chcú moderný look s kontrastom",
      "Komu sedí kratší vrchný styling alebo prirodzene padajúce vlasy",
      "Pánov, ktorí chcú niečo viac ako klasický strih",
    ],
    howItWorks: [
      "Dohodneme typ fade — low, mid, high alebo skin fade",
      "Začneme strojčekom s rôznymi výškami strihacieho hrebeňa",
      "Postupné rozmazanie prechodov, kontrola z viacerých uhlov",
      "Detailná dorábka britvou pri pokožke",
      "Vrchný strih nožnicami podľa vašej požiadavky",
      "Styling",
    ],
    whyUs:
      "Fade je technika, ktorá sa nedá odflákať — buď je perfektný, alebo viditeľne zlý. Pracujeme s ním každý deň a vieme, že rozdiel je v milimetri.",
    durationLabel: "45–60 minút",
    relatedSlugs: ["pansky-strih", "strojcek-ritual"],
  },
  {
    slug: "uprava-brady",
    name: "Úprava brady a fúzov",
    metaDescription:
      "Úprava brady a fúzov v Bytči — strih nožnicami aj britvou, hot towel, finálne ošetrenie olejom. Rezervujte si termín online.",
    intro:
      "Brada nie je len dĺžka — je to tvar, prechody na líci, line-up pri krku a hladkosť pokožky pod ňou. Robíme strih nožnicami a britvou. Pre väčšie pohodlie pred holením používame hot towel, ktorý otvorí póry a uvoľní pokožku, takže výsledok je hladší a podráždenie minimálne.",
    forWhom: [
      "Pánov s plnou bradou, ktorí ju chcú mať tvarovanú a upravenú",
      "Kto chce udržať 5-day shadow look bez chaotického rastu",
      "Komu rastie brada nerovnomerne a treba šikovnú ruku barbera",
    ],
    howItWorks: [
      "Konzultácia o tvare brady — čo vám sedí podľa tváre",
      "Skrátenie brady nožnicami na požadovanú dĺžku",
      "Hot towel pre zmäkčenie pokožky a uvoľnenie pórov",
      "Britva — line-up na lícach a pri krku",
      "Finálne ošetrenie olejom alebo balzamom",
    ],
    whyUs:
      "Britva je o detaile — milimetre rozhodujú. Neupravená brada vyzerá zanedbane, skutočne dobre tvarovaná dáva tvári hrany a charakter.",
    durationLabel: "30–45 minút",
    relatedSlugs: ["hot-towel-ritual", "strojcek-ritual"],
  },
  {
    slug: "hot-towel-ritual",
    name: "Hot towel rituál",
    metaDescription:
      "Hot towel rituál v Bytči — tradičné holenie britvou s horúcimi uterákmi. Hladká pokožka, žiadne podráždenie. Rezervujte si termín.",
    intro:
      "Tradičná barberská metóda holenia, ktorá sa robí už viac ako sto rokov a stále funguje najlepšie. Horúci uterák zmäkčí bradu, otvorí póry a uvoľní svaly tváre. Britva potom kĺže po pokožke bez podráždenia. Zážitok je polovica relax, polovica grooming — niektorí klienti k nám chodia práve kvôli tomuto rituálu.",
    forWhom: [
      "Kto chce dokonale hladkú pokožku, akú strojček nedosiahne",
      "Pri špeciálnych príležitostiach — svadba, fotenie, dôležité stretnutie",
      "Chcete si dopriať pravú barberskú procedúru",
    ],
    howItWorks: [
      "Príprava pokožky — čistenie a tonik",
      "Pena alebo olej na holenie",
      "Horúce uteráky 2–3× pre maximálne zmäkčenie brady",
      "Holenie britvou v smere a proti smeru rastu",
      "Studený uterák pre zatvorenie pórov",
      "After-shave balzam pre upokojenie pokožky",
    ],
    whyUs:
      "Túto procedúru nedokáže nahradiť strojček ani jednorazová britva. Klasická straight razor v rukách barbera je niečo úplne iné.",
    durationLabel: "30–45 minút",
    relatedSlugs: ["uprava-brady", "strojcek-ritual"],
  },
  {
    slug: "strojcek-ritual",
    name: "Strojček rituál",
    metaDescription:
      "Strojček rituál v Bytči — kompletný balík: strih, úprava brady, hot towel a styling. Full service pre dôležité príležitosti.",
    intro:
      "Náš signatúrny balík, kde dostanete všetko v jednom termíne — strih, úpravu brady, hot towel a voskovú finálnu úpravu. Komplexný full service pre tých, ktorí si chcú dopriať dlhší termín a odísť kompletne upravení od hlavy po bradu.",
    forWhom: [
      "Dôležité príležitosti — svadba, oslavy, business stretnutia",
      "Pánov, ktorí radšej prídu raz za 4–6 týždňov a vybavia všetko naraz",
      "Prvá návšteva — chcete vyskúšať full barberskú skúsenosť",
    ],
    howItWorks: [
      "Konzultácia (vlasy aj brada spolu)",
      "Strih podľa typu vlasov a tvaru tváre",
      "Hot towel rituál a holenie britvou",
      "Voskový styling vlasov",
      "Olejovanie brady, after-shave balzam",
    ],
    whyUs:
      "Strojček rituál je ako pol hodiny dovolenky. Vychutnajte si ten čas — telefón položte na stôl.",
    durationLabel: "približne 75 minút",
    relatedSlugs: ["pansky-strih", "uprava-brady"],
  },
];

export function getServiceBySlug(slug: string): ServiceContent | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

export const ALL_SERVICE_SLUGS: readonly string[] = SERVICES.map((s) => s.slug);
