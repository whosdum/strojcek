// Shared font loader for OG image generators. Plus Jakarta Sans is the
// site font (next/font/google in layout.tsx) — matching it in OG images
// keeps social previews visually consistent with the live site.
//
// Google Fonts CSS endpoint returns WOFF2 by default; Satori (engine
// behind ImageResponse) supports WOFF2 since Next.js 14. We force-cache
// so subsequent build-time renders don't re-fetch on every revalidation.

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800";

interface CachedFont {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 700 | 800;
  style: "normal";
}

let cached: Promise<CachedFont[]> | null = null;

export function loadJakartaFonts(): Promise<CachedFont[]> {
  if (cached) return cached;
  cached = (async () => {
    // Satori (≤ Next 16) doesn't accept WOFF2 — "Unsupported OpenType
     // signature wOF2". An IE9-era User-Agent makes Google Fonts fall
     // back to TTF, which Satori parses fine.
    const css = await fetch(FONT_CSS_URL, {
      cache: "force-cache",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)",
      },
    }).then((r) => r.text());

    const blocks = css.split("@font-face");
    const out: CachedFont[] = [];

    for (const weight of [500, 700, 800] as const) {
      const block = blocks.find((b) =>
        new RegExp(`font-weight:\\s*${weight}\\b`).test(b)
      );
      if (!block) continue;
      // Google Fonts with IE-era UA returns WOFF (not WOFF2 — Satori
      // can't parse WOFF2 in this Next version). Accept WOFF, TTF, or
      // OTF; reject WOFF2 explicitly.
      const m =
        block.match(/url\((https[^)]+)\)\s*format\(['"](?:woff|truetype|opentype)['"]\)/);
      if (!m) continue;
      const data = await fetch(m[1], { cache: "force-cache" }).then((r) =>
        r.arrayBuffer()
      );
      out.push({ name: "Plus Jakarta Sans", data, weight, style: "normal" });
    }

    if (out.length === 0) {
      throw new Error(
        `loadJakartaFonts: no TTF URLs parsed from CSS (got ${css.length} chars)`
      );
    }

    return out;
  })();
  return cached;
}
