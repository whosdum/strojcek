// Recenzie zobrazené na webe — najlepšie z Google Reviews.
// Polia musia byť reálne (autor, dátum, text). Skrátenie textu „..." je OK,
// ale neupravujte význam. Po novej významnej recenzii pridajte sem manuálne
// (raz za 2–3 mesiace stačí).

export interface PublicReview {
  authorName: string; // formát ako Google: „Marek H." alebo plné meno ak ho dal autor
  rating: 1 | 2 | 3 | 4 | 5;
  date: string; // ISO date "YYYY-MM-DD" (deň môže byť aproximácia, UI ukazuje len mesiac + rok)
  text: string;
  url?: string; // direct share link na konkrétnu Google recenziu (verifikácia)
}

export const PUBLIC_REVIEWS: PublicReview[] = [
  {
    authorName: "Anna Pipichová",
    rating: 5,
    date: "2026-03-05",
    text: "Môžem len odporúčať, za mňa výborný objednávací systém (každý si vyberie podľa seba), pekné prostredie a veľmi príjemný personál p. Martin. Ako žena som išla trochu s obavami ale opadli zo mňa hneď vo dverách, bola som už druhý krát a určite sa budem vracať. Takýchto kvalitných služieb by mohlo byť viac a nielen v Bytči. Odporúčam.",
    url: "https://share.google/intKRtS7rgGUbf0WR",
  },
  {
    authorName: "Filip Lulek",
    rating: 5,
    date: "2026-02-08",
    text: "Ak sa chcem cítiť fresh a upravený, toto miesto je pre mňa jasná voľba. Pravidelne sa sem vraciam kvôli kombinácii špičkových služieb, prémiových priestorov a skvelej kávy. Celkový zážitok je na vysokej úrovni.",
    url: "https://share.google/sbqdcBiRRiayMcEwM",
  },
  {
    authorName: "Martin Gálik",
    rating: 5,
    date: "2026-03-10",
    text: "Výborný barbier a super chalan, odporúčam 👍",
    url: "https://share.google/ImBQncKmEZb36BxvX",
  },
  {
    authorName: "Juraj Bielik",
    rating: 5,
    date: "2026-02-12",
    text: "So službami v tomto barbershope som nadmieru spokojný. Milý a odborný personál, štýlovo zariadený priestor a dobre odvedená práca barbera. Určite budem služby pána Mikolášika využívať aj naďalej.",
    url: "https://share.google/aenCqDpP3qv1zk8O2",
  },
  {
    authorName: "To Krupa",
    rating: 5,
    date: "2026-03-18",
    text: "Vrelo odporúčam, super prístup, krásne priestory, taktiež práca 👌👌👌",
    url: "https://share.google/zzqxuvEAv7gbyHNvP",
  },
  {
    authorName: "Adam B",
    rating: 5,
    date: "2026-05-06",
    text: "Konečne aj v Bytči miesto, kde rozumejú tomu, čo robia 💪🏼💪🏼💪🏼",
    url: "https://share.google/smYinkpPap2ZBvZNM",
  },
];

// Aggregate stats — z GBP. Update keď čísla narastú.
export const AGGREGATE_RATING = {
  ratingValue: 5.0,
  reviewCount: 28,
  bestRating: 5,
} as const;
