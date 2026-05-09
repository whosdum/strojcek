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
};

export default nextConfig;
