const DIACRITICS_MAP: Record<string, string> = {
  á: "a", ä: "a", à: "a", â: "a", ã: "a",
  č: "c", ć: "c",
  ď: "d",
  é: "e", ě: "e", ê: "e", ë: "e", è: "e",
  í: "i", î: "i", ï: "i", ì: "i",
  ĺ: "l", ľ: "l", ł: "l",
  ň: "n", ñ: "n",
  ó: "o", ô: "o", ö: "o", ò: "o", õ: "o",
  ŕ: "r", ř: "r",
  š: "s", ś: "s",
  ť: "t",
  ú: "u", ů: "u", ü: "u", ù: "u", û: "u",
  ý: "y", ÿ: "y",
  ž: "z", ź: "z", ż: "z",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => DIACRITICS_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
