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
    // Homepage gallery thumbs use quality={70} to shave bytes on tiny
    // 130px tiles (Lighthouse savings). Next.js v15+ requires every quality
    // we generate to be enumerated up front; default is just [75].
    qualities: [70, 75],
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
