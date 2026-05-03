import "server-only";
import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/server/lib/firebase-admin";

export const SESSION_COOKIE = "__session";

/** Audience pinning: a session cookie minted for a different Firebase
 *  project shouldn't be accepted even if it cryptographically validates.
 *  Pulled once at module load — the project id is fixed for an instance. */
const expectedAudience: string | undefined =
  adminAuth.app.options.projectId ??
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/** Firebase auth error codes that legitimately mean "this cookie is no
 *  longer good — show the login screen". Anything else (network blip,
 *  Firebase outage, internal SDK bug) bubbles up so we can see it. */
const INVALID_SESSION_CODES = new Set([
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/argument-error",
  "auth/invalid-session-cookie",
  "auth/user-disabled",
  "auth/user-not-found",
]);

/** In-process cache of live admin-claim status, keyed by uid. Refreshed
 *  every 60s so an admin who has their role revoked loses access within
 *  a minute on each Cloud Run instance, instead of waiting up to 7 days
 *  for the session cookie to expire. */
type ClaimCacheEntry = { isAdmin: boolean; expiresAt: number };
const CLAIM_CACHE_TTL_MS = 60_000;
const claimCache = new Map<string, ClaimCacheEntry>();

async function isLiveAdmin(uid: string): Promise<boolean> {
  const now = Date.now();
  const cached = claimCache.get(uid);
  if (cached && cached.expiresAt > now) return cached.isAdmin;
  const user = await adminAuth.getUser(uid);
  const isAdmin = (user.customClaims?.role as string | undefined) === "admin";
  claimCache.set(uid, { isAdmin, expiresAt: now + CLAIM_CACHE_TTL_MS });
  return isAdmin;
}

export async function getSession(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : null;
    if (code && INVALID_SESSION_CODES.has(code)) return null;
    // Anything else (network, Firebase outage, malformed admin SDK
    // state) is operationally interesting — log loudly so we don't
    // silently 401 every admin request during an incident, and rethrow
    // so the caller's try/catch can return a 5xx instead of 401.
    console.error("[auth] verifySessionCookie unexpected error:", err);
    throw err;
  }

  if (expectedAudience && decoded.aud !== expectedAudience) {
    console.warn(
      `[auth] aud mismatch: got=${decoded.aud}, expected=${expectedAudience}`
    );
    return null;
  }

  // Quick fail on the role baked into the cookie at issuance time —
  // saves a getUser() round-trip when the cookie clearly isn't an admin.
  if (decoded.role !== "admin") return null;

  // Authoritative check against current claims. Without this, removing
  // a user's role=admin in the Firebase console wouldn't take effect
  // until either the cookie expired (7d) or refresh tokens were
  // explicitly revoked. Cached 60s per uid.
  let stillAdmin: boolean;
  try {
    stillAdmin = await isLiveAdmin(decoded.sub);
  } catch (err) {
    console.error("[auth] live claim fetch failed:", err);
    return null;
  }
  if (!stillAdmin) {
    // Drop the cache entry so a re-grant of the role takes effect on
    // the very next request rather than 60s later.
    claimCache.delete(decoded.sub);
    return null;
  }

  return decoded;
}

export async function requireAdminSession(): Promise<DecodedIdToken> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
