# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strojcek is a barber shop booking system with two parts: a public 5-step booking wizard for customers and an admin panel for the shop owner. It's a Next.js 16 monolith on **Firebase Firestore** + **Firebase Auth**, built for a Slovak barber shop (UI text in Slovak, timezone Europe/Bratislava).

> **Note:** the `feat/firebase-firestore-rewrite` branch (current) replaces the original Postgres + Prisma + Better Auth stack with Firebase. The `main` branch on remote still runs the legacy Vercel + Supabase stack — do not assume parity.

## Commands

```bash
npm run dev              # Start dev server (talks to live Firestore via admin SDK)
npm run build            # next build (no migrations — Firestore is schemaless)
npm run lint             # ESLint
npm run dev:emulators    # firebase emulators (Auth :9099, Firestore :8080, UI :4000)
npm run dev:app          # Next.js dev pointed at local emulators

# Scripts
npx tsx scripts/create-admin.ts              # Create admin Firebase user (admin@strojcek.sk / admin123) + role=admin claim
npx tsx scripts/seed-firestore.ts            # Wipe + seed Firestore (1 barber, 5 services, schedules, breaks, settings)
npx tsx scripts/test-firebase-connection.ts  # Verify firebase-admin auth + Firestore write/read
firebase deploy --only firestore:rules,firestore:indexes  # Deploy security rules + composite indexes
```

## Architecture

### Route Groups

- `src/app/page.tsx` — Booking wizard (5-step: service → barber → datetime → details → confirm)
- `src/app/(public)/` — Public pages (`/cancel`, `/vop`, `/ochrana-udajov`)
- `src/app/(admin)/` — Admin panel (auth-protected via `__session` cookie + Firebase custom claim `role=admin`)
  - `/login` — Firebase Auth `signInWithEmailAndPassword`, then POST idToken to `/api/auth/session`
  - `/admin/*` — Dashboard, calendar, reservations, barbers, services, schedule, customers
- `src/app/api/`
  - `/auth/session` — POST creates `__session` cookie via `createSessionCookie()`, DELETE clears
  - `/admin/calendar`, `/admin/services` — guarded JSON endpoints
  - `/cron/reminders` (daily 16:00 UTC), `/cron/cleanup` (daily 03:00 UTC) — `Authorization: Bearer $CRON_SECRET`

### Server Layer (`src/server/`)

- **lib/**
  - `firebase-admin.ts` — initializes `firebase-admin/app` with credentials from env. Exports `adminAuth` and `adminDb` singletons. Both are server-only.
  - `auth.ts` — `getSession()` reads the `__session` cookie, calls `verifySessionCookie()`, requires `role=admin` custom claim
  - `firestore-utils.ts` — `tsToDate`, `dateKey`, `hourKey`, `generateSearchTokens`, `stripUndefined`
  - `email.ts` (nodemailer wrapper), `sms.ts` (SMSTools.sk), `telegram.ts`, `phone.ts`, `tokens.ts`, `strings.ts`
- **actions/** — Server Actions (mutations). All use `adminDb.runTransaction()` where atomicity matters (booking, status changes, customer phone uniqueness)
- **queries/** — Server-side Firestore reads. All return view-model shapes from `@/lib/types`
- **types/firestore.ts** — Typed shapes for every Firestore document

### Client Layer (`src/lib/`)

- `firebase-client.ts` — initializes the Web SDK from `NEXT_PUBLIC_FIREBASE_*` env. Optionally binds to local emulators when `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`
- `types.ts` — Shared `AppointmentStatus`, view models (`AppointmentView`, `BarberView`, etc.). UI components import enums + types from here, never from anywhere Postgres-flavored
- `validators.ts` — Zod schemas for all entities
- `constants.ts` — Business rules: `MIN_CANCEL_HOURS = 2`, `PAGE_SIZE = 25`, `GLOBAL_BOOKING_LIMIT = 30`, `PHONE_BOOKING_LIMIT_24H = 3`, `SLOT_GROUP_BOUNDARIES`, `VALID_STATUS_TRANSITIONS`, `formatCurrency()`. `SLOT_INTERVAL_MINUTES = 60` is a fallback — actual value is read from `shopSettings/default` at runtime

### Firestore data model

Top-level collections:

```
/services/{serviceId}
/barbers/{barberId}                       (denormalized serviceIds[] for fast filtering)
/barbers/{barberId}/services/{serviceId}  (BarberService — denormalized service info to avoid N+1)
/barbers/{barberId}/schedules/{dayOfWeek} (doc id = "0".."6")
/barbers/{barberId}/breaks/{breakId}
/barbers/{barberId}/overrides/{YYYY-MM-DD}

/customers/{customerId}                   (UUID; searchTokens[] for prefix search)
/customerPhones/{phone}                   (lookup index — guarantees phone uniqueness)

/appointments/{appointmentId}             (denormalized barberName, serviceName, serviceBufferMinutes, startDateKey, customer*)
/appointments/{appointmentId}/history/{id}

/shopSettings/default
/users/{firebaseUid}                      (admin profile + role)
/counters/global_bookings                 ({ hourly: { "2026-04-30T14": 7 } } — 1h global rate limit)
/counters/phone_{normalizedPhone}         ({ bookings: Timestamp[] } — 24h per-phone rate limit)
```

### Decimal precision

All prices stored as `priceCents: number` (integer). UI divides by 100 for display. This avoids IEEE-754 rounding bugs that Firestore would inherit if we used `Decimal(10,2)`.

### Slot conflict + race conditions

Postgres had an `EXCLUDE` constraint that DB-enforced no overlapping bookings. Firestore has no equivalent. Booking creation runs inside `adminDb.runTransaction()` and:

1. Re-reads the per-phone + global counters and rejects if over limit
2. Re-reads all appointments matching `(barberId, startDateKey)` and rejects on overlap
3. Creates appointment + history + counter updates atomically

`runTransaction` retries on contention; the residual race window is ~ms. Plan §19 documents this as accepted ~0.001% error at current scale.

### Auth flow

```
Login                       → signInWithEmailAndPassword(auth, email, pw)
                            → idToken = user.getIdToken()
                            → POST /api/auth/session { idToken }

POST /api/auth/session      → adminAuth.verifyIdToken()
                            → require role=admin custom claim
                            → adminAuth.createSessionCookie(idToken, 7d)
                            → Set-Cookie: __session (httpOnly, lax, secure in prod)

Server (layout, API routes) → getSession() reads __session
                            → adminAuth.verifySessionCookie()
                            → returns null if no role=admin claim

Logout                      → signOut(auth) [client]
                            → DELETE /api/auth/session [server cookie clear]
```

Custom claims are set by `scripts/create-admin.ts` (idempotent; safe to run again).

## Key Patterns

- **Booking wizard state** is stored in URL search params, not client state
- **No Prisma, no Postgres.** All data goes through `adminDb` (server) or `db` (client). Client SDK is rarely used directly — admin pages render server-side and stream data through server queries
- **Path alias**: `@/*` maps to `./src/*`
- **Email/SMS/Telegram** still send asynchronously with `.catch()` — failures don't block the user flow
- **Date handling**: `date-fns` + `date-fns-tz` with `Europe/Bratislava` timezone. Appointment `startDateKey` is the Bratislava-local YYYY-MM-DD used as the canonical day key for queries
- **Search**: `searchTokens[]` array on customer docs — generated from name prefixes + phone-tail digits. `array-contains` on a lowercased query gives prefix matching
- **Firestore caching**: there is no server-side cache layer. Reads are cheap (free tier 50K/day) and freshness matters more than latency. React Query handles client-side caching where appropriate

## Environment variables

```
# Firebase Admin SDK (server-only)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY        # full -----BEGIN/END----- string with literal \n

# Firebase Web SDK (browser)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# Optional
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true   # bind client SDK to localhost emulators

# External services
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS    (or use Resend later)
EMAIL_FROM
SMSTOOLS_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
CRON_SECRET                  # Bearer token for /api/cron/* endpoints
NEXT_PUBLIC_APP_URL
```

`serviceAccountKey.json` lives at the repo root, gitignored. Use it only for local scripts that bootstrap the project; the dev server reads credentials from env vars.

## Deployment (Firebase App Hosting)

`apphosting.yaml` at the repo root drives the deploy. App Hosting **requires Blaze (pay-as-you-go)** — Spark won't work because it provisions Cloud Run + Cloud Build under the hood. Free tier on Blaze still covers our scale at $0/mes.

**First-time setup:**

```bash
# 1. Upgrade project to Blaze in Firebase Console → Settings → Usage and billing
# 2. Create the App Hosting backend (connects to GitHub branch)
firebase apphosting:backends:create --project strojcek-staging
#    → choose region europe-west4 (or europe-west1)
#    → connect repo + branch feat/firebase-firestore-rewrite
# 3. Push secrets to Cloud Secret Manager
./scripts/setup-apphosting-secrets.sh strojcek-staging
# 4. First deploy
git push origin feat/firebase-firestore-rewrite
#    → App Hosting auto-builds + deploys on every push
```

`scripts/setup-apphosting-secrets.sh` reads `.env` and pushes each server secret (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SMTP_*`, `SMSTOOLS_API_KEY`, `TELEGRAM_*`, `CRON_SECRET`) to Cloud Secret Manager. Public values (`NEXT_PUBLIC_FIREBASE_*`) are inlined in `apphosting.yaml` — they ship in the client bundle anyway.

After deploy, update `NEXT_PUBLIC_APP_URL` in `apphosting.yaml` to the actual backend URL (Console shows it after first deploy), then commit + push.

## Other notes

- `Audit.md` is a 45-item UI/UX audit (P0–P3 priorities) — consult it before making UI changes
- `.github/workflows/cron.yml` schedules cron HTTP calls to `/api/cron/*` — when deployed to App Hosting, set the GitHub Actions `APP_URL` repo secret to the backend URL
- Plan: `~/.claude/plans/priprav-mi-detailny-plan-dynamic-pancake.md` has the full migration spec (parts 1–19)
