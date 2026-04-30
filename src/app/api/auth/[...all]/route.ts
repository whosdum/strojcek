// Stub: Better Auth handler removed in Firebase migration.
// Use POST/DELETE on /api/auth/session for Firebase session cookies.
// File kept as inert stub pending user decision on full deletion.
export const dynamic = "force-static";

import { NextResponse } from "next/server";

function gone() {
  return NextResponse.json(
    { error: "Endpoint removed. Use /api/auth/session." },
    { status: 410 }
  );
}

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const DELETE = gone;
