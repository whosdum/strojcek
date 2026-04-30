import { NextResponse, type NextRequest } from "next/server";

// Edge runtime cannot run firebase-admin (no Node.js APIs / TCP), so this
// middleware can only check whether a `__session` cookie is present — not
// whether it is signed correctly or carries the role=admin claim. The real
// security check still happens in server components / API routes via
// `getSession()` → `verifySessionCookie()`. This middleware is a cheap early
// filter that redirects unauthenticated requests to /login before any RSC
// rendering or Firestore reads happen.

export function middleware(req: NextRequest) {
  const session = req.cookies.get("__session");
  if (!session?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
