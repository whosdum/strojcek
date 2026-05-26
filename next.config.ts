import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase App Hosting auto-applies `output: "standalone"`. In that
  // mode Next.js only copies /public files it can statically trace
  // from code (e.g. `<Image src="/logo.jpg">`). String paths held in
  // arrays — like INTERIOR_PHOTOS in /o-nas referencing /barbershop/*
  // and /barbers/* — are invisible to the tracer and therefore never
  // shipped to the Cloud Run container, returning 404 in production.
  //
  // outputFileTracingIncludes forces those folders into the build
  // artifact for every route, restoring /public/* asset serving that
  // worked before standalone tracing kicked in.
  //
  // Symptom that led here: only /logo.jpg returned 200 on prod;
  // every other /public file returned 404 with x-nextjs-prerender:1
  // (the not-found page took over because the static file was never
  // deployed). `npm run start` locally served them fine because that
  // path doesn't go through the standalone bundle.
  outputFileTracingIncludes: {
    "*": ["./public/**/*"],
  },
  images: {
    // Firebase App Hosting's adapter v14.0.21 (that's Firebase's own
    // versioning, not "Next.js 14") returns 4xx on /_next/image when running
    // Next.js 16. Browser falls back to the full-size source — costs ~340 KB
    // on the homepage thumbnails. Firebase closed the report as "expected
    // versioning" without addressing the underlying bug, so we pre-bake size
    // variants via scripts/generate-image-variants.ts and disable Next.js's
    // broken srcset emission here.
    // Issue: github.com/firebase/apphosting-adapters/issues/564
    unoptimized: true,
    // Homepage gallery thumbs use quality={70} to shave bytes on tiny
    // 130px tiles (Lighthouse savings). Next.js v15+ requires every quality
    // we generate to be enumerated up front; default is just [75].
    qualities: [70, 75],
    // Blog covers in /public/blog/*.svg need this — Next.js's image
    // optimizer refuses to serve SVG by default (SVG can contain script
    // tags). We control these SVGs (committed in repo, no user upload),
    // so allowing them is safe. CSP below pins them to image-only
    // rendering so even if a future SVG slipped a <script>, the browser
    // wouldn't execute it.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Blog cover + inline images live in Firebase Storage. The Web SDK
    // serves them via `firebasestorage.googleapis.com` (download-URL
    // endpoint with a per-file token); next/image refuses unknown hosts
    // unless we list them here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Blog image uploads (cover + inline) cap at 10 MB on both client and
      // server. Next.js's default Server Action body limit is 1 MB, which
      // rejects anything larger with a 500 before our action handler runs.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
