import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/server/lib/firebase-admin";
import { SESSION_COOKIE } from "@/server/lib/auth";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

export async function POST(request: NextRequest) {
  // Same-origin guard: require Origin matches the configured app URL when one
  // is set. This blocks login-CSRF where evil.com posts an idToken to our
  // /api/auth/session and pins a session cookie for the victim's browser.
  // Skipped only in dev when NEXT_PUBLIC_APP_URL is unset.
  if (SITE_ORIGIN) {
    const origin = request.headers.get("origin");
    if (origin && origin !== SITE_ORIGIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
