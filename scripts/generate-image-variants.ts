/**
 * Generates *-thumb.webp variants of /public/barbershop/*.webp at 320px wide.
 *
 * Why this exists: Firebase App Hosting on Next.js 16 ships an outdated v14
 * adapter that doesn't expose `/_next/image` (returns 404). Without the
 * runtime image optimizer, every <Image src="..."> falls back to serving the
 * full-size 960×1280 source — which on the homepage's 4 thumbnail tiles
 * (130px display) costs ~340 KB of unnecessary bytes per page load.
 *
 * Workaround per github.com/firebase/apphosting-adapters/issues/564:
 * pre-bake appropriately-sized variants at build time and reference them
 * directly. The homepage uses -thumb.webp for tiles; /o-nas keeps the full
 * 960px originals for its larger gallery.
 *
 * Run manually when source images change:
 *   npx tsx scripts/generate-image-variants.ts
 *
 * Output files are committed to the repo so the deploy doesn't depend on
 * a prebuild step running in Firebase's build environment.
 */

import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.join(process.cwd(), "public/barbershop");
const THUMB_WIDTH = 320;
const THUMB_QUALITY = 80;
const THUMB_SUFFIX = "-thumb";

async function main() {
  const entries = await readdir(SRC_DIR);
  const sources = entries.filter(
    (f) => f.endsWith(".webp") && !f.includes(THUMB_SUFFIX)
  );

  if (sources.length === 0) {
    console.log("No source .webp files found in /public/barbershop/");
    return;
  }

  console.log(
    `Generating ${THUMB_WIDTH}px-wide thumbs for ${sources.length} images:\n`
  );

  let totalSrc = 0;
  let totalOut = 0;

  for (const file of sources) {
    const srcPath = path.join(SRC_DIR, file);
    const thumbName = file.replace(/\.webp$/, `${THUMB_SUFFIX}.webp`);
    const thumbPath = path.join(SRC_DIR, thumbName);

    const meta = await sharp(srcPath).metadata();
    await sharp(srcPath)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY, effort: 6 })
      .toFile(thumbPath);

    const srcSize = (await stat(srcPath)).size;
    const outSize = (await stat(thumbPath)).size;
    totalSrc += srcSize;
    totalOut += outSize;

    const ratio = ((1 - outSize / srcSize) * 100).toFixed(1);
    console.log(
      `  ${file} (${meta.width}×${meta.height}, ${kb(srcSize)})` +
        ` → ${thumbName} (${kb(outSize)}, −${ratio}%)`
    );
  }

  const overallRatio = ((1 - totalOut / totalSrc) * 100).toFixed(1);
  console.log(
    `\nTotal: ${kb(totalSrc)} → ${kb(totalOut)} (−${overallRatio}%)`
  );
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
