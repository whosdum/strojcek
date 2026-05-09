import { NextResponse, type NextRequest } from "next/server";

// Two responsibilities:
//
// 1. Canonicalize www → apex via 301. `rel=canonical` is only a hint;
//    Google overrode it and picked the www subdomain as canonical even
//    after we added the tag. A hard 301 is the only directive Google
//    treats as authoritative when the same content lives at multiple
//    hosts.
//
// 2. Cheap auth gate for /admin. Edge runtime cannot run firebase-admin
//    (no Node.js APIs / TCP), so this middleware only checks whether a
//    `__session` cookie is present — the real signature + role=admin
//    claim check still runs in server components / API routes via
//    `getSession()` → `verifySessionCookie()`. The cookie presence
//    check here just shaves a round-trip + RSC render for unauth'd
//    visitors hitting /admin/*.

const APEX_HOST = "strojcekbarbershop.sk";

export function middleware(req: NextRequest) {
  // Skip /api on the redirect path. APIs are non-branded — there's no SEO
  // reason for them to be on apex, and 301 silently downgrades POST → GET
  // in some clients. /api stays reachable on both hosts; everything user
  // facing gets canonicalized.
  //
  // Prefer x-forwarded-host: on Firebase App Hosting / Cloud Run the
  // request's `Host` header is the internal Cloud Run hostname, not the
  // public domain the user actually visited. The same pattern is used
  // by the auth same-origin guard.
  const host = (
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    ""
  ).toLowerCase();
  if (
    host === `www.${APEX_HOST}` &&
    !req.nextUrl.pathname.startsWith("/api")
  ) {
    const url = req.nextUrl.clone();
    url.host = APEX_HOST;
    url.protocol = "https:";
    url.port = "";
    // 308 = Permanent Redirect with method preservation (RFC 7538).
    // Google treats it identically to 301 for canonicalization.
    return NextResponse.redirect(url, 308);
  }

  if (req.nextUrl.pathname.startsWith("/admin")) {
    const session = req.cookies.get("__session");
    if (!session?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on routes only — exclude Next.js internals and ANY path that
  // looks like a file (contains a dot before its end). On Firebase App
  // Hosting (Next.js adapter ~14), middleware running on /public asset
  // paths and returning NextResponse.next() does NOT fall through to
  // the static-file handler — the request continues into the App Router
  // which has no matching route, returning 404. `next dev` has a
  // different request flow so the same matcher worked locally.
  //
  // The previous explicit allowlist (logo.jpg, robots.txt, sitemap.xml)
  // was incomplete: it broke /barbershop/*.webp, /barbers/*.webp,
  // /llms.txt, /BingSiteAuth.xml, and any future asset added under
  // /public.
  //
  // Trade-off: a www-prefixed asset URL no longer 308-redirects to apex.
  // That's acceptable — Google ranks pages, not asset paths, and asset
  // requests resolve to the right content either way.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
