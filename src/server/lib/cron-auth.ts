import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Verify the `Authorization: Bearer <secret>` header on cron endpoints
 * with a constant-time compare. Returns a 401 NextResponse on failure
 * (and logs the source IP so unauthorised attempts are visible in logs).
 *
 * The CRON_SECRET is a long random token, so timing-attack feasibility
 * is essentially zero on the public internet — but constant-time
 * compare costs nothing and is the standard idiom.
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!cronSecret) {
    console.error("[cron-auth] CRON_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const got = Buffer.from(authHeader);

  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    const ip =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      "unknown";
    console.warn(`[cron-auth] 401 from ${ip} (path=${req.nextUrl.pathname})`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
