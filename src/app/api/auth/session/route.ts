import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/server/lib/firebase-admin";
import { SESSION_COOKIE } from "@/server/lib/auth";

const CONFIGURED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

/**
 * Build the set of origins the server treats as "ourselves" for the
 * same-origin CSRF guard. We accept:
 *   - the configured NEXT_PUBLIC_APP_URL (custom domain), and
 *   - whatever the request claims its host is (the auto-generated
 *     App Hosting URL, the custom domain, or a preview URL — they
 *     all reach the same Cloud Run instance).
 * This avoids 403 when the project is reachable on multiple hosts.
 */
function allowedOrigins(req: NextRequest): Set<string> {
  const allowed = new Set<string>();
  if (CONFIGURED_ORIGIN) allowed.add(CONFIGURED_ORIGIN);

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ??
      (req.nextUrl.protocol.replace(/:$/, "") || "https");
    allowed.add(`${proto}://${host}`);
  }
  return allowed;
}

export async function POST(request: NextRequest) {
  // Same-origin guard. Blocks login-CSRF where evil.com POSTs an idToken
  // to pin a session cookie in the victim's browser.
  //
  // Browsers may legitimately omit Origin on certain navigations / form
  // submissions, so when it's absent we fall back to Sec-Fetch-Site —
  // a header browsers always populate and which forged cross-origin
  // requests can't spoof. If neither header is present (pre-Fetch
  // Metadata clients, ancient browsers, curl), we refuse rather than
  // accepting unconditionally.
  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = allowedOrigins(request);
    if (!allowed.has(origin)) {
      console.warn(
        `[auth/session] Origin mismatch: got ${origin}, allowed=${[...allowed].join(",")}`
      );
      return NextResponse.json(
        { error: "origin_mismatch" },
        { status: 403 }
      );
    }
  } else {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite !== "same-origin" && fetchSite !== "same-site") {
      console.warn(
        `[auth/session] Origin missing and sec-fetch-site=${fetchSite ?? "<absent>"}`
      );
      return NextResponse.json(
        { error: "origin_required" },
        { status: 403 }
      );
    }
  }

  let idToken: string | undefined;
  try {
    const body = await request.json();
    idToken = body?.idToken;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (decoded.role !== "admin") {
    return NextResponse.json({ error: "no_admin_claim" }, { status: 403 });
  }

  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
  } catch {
    return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionCookie, {
    maxAge: SESSION_DURATION_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;

  // Revoke Firebase refresh tokens server-side so a stolen __session
  // cookie cannot keep producing new ID tokens for the rest of its
  // 7-day lifetime. verifySessionCookie(_, true /* checkRevoked */) in
  // getSession() then rejects on the next request.
  if (sessionCookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie);
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Cookie is invalid or already revoked — nothing to do.
    }
  }

  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
