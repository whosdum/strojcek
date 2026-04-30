import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/server/lib/firebase-admin";
import { SESSION_COOKIE } from "@/server/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

export async function POST(request: NextRequest) {
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
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
