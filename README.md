[![Cron Jobs](https://github.com/whosdum/strojcek/actions/workflows/cron.yml/badge.svg)](https://github.com/whosdum/strojcek/actions/workflows/cron.yml)

# Strojcek

Barber-shop booking system for a Slovak barbershop. Two parts in one Next.js 16 monolith:

- **Public booking wizard** — 5-step flow (service → barber → date/time → details → confirm) at `/`
- **Admin panel** — dashboard, calendar, reservations, customers, barbers, services, schedule at `/admin/*`

UI text is in Slovak; timezone is `Europe/Bratislava`.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Firebase Firestore** for all persistence (no Postgres, no ORM)
- **Firebase Auth** with custom `role=admin` claim + 7-day session cookies
- **Firebase App Hosting** for deploy (Cloud Run + Cloud Build under the hood)
- **Tailwind v4** + shadcn/ui + FullCalendar
- **Nodemailer** (SMTP) for email, **SMSTools.sk** for SMS, **Telegram Bot API** for admin notifications
- **GitHub Actions** cron hitting `/api/cron/*` endpoints

For architecture detail see [CLAUDE.md](./CLAUDE.md).

## Local development

### Option A — talk to live Firestore

The fastest way; all reads/writes go to the real `strojcek-staging` project.

```bash
npm install
npm run dev                              # http://localhost:3000
```

Requires a populated `.env` (see [.env.example](./.env.example)) with `FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_*`, and at minimum `EMAIL_FROM` for booking confirmation links to render.

### Option B — fully offline with emulators

Two terminals:

```bash
npm run dev:emulators                    # Auth :9099, Firestore :8080, UI :4000
```

```bash
npm run dev:app                          # Next.js bound to the emulators
```

Then seed the local emulator:

```bash
npx tsx scripts/seed-firestore.ts        # 1 barber, 5 services, schedules, breaks, settings
npx tsx scripts/create-admin.ts          # admin@strojcek.sk / admin123 with role=admin claim
```

Open the Emulator UI at <http://localhost:4000> to inspect docs.

### Other useful commands

```bash
npm run build                            # next build
npm run lint                             # ESLint

npx tsx scripts/test-firebase-connection.ts        # smoke-test admin SDK auth + Firestore write
firebase deploy --only firestore:rules,firestore:indexes
```

## Deploy (Firebase App Hosting)

App Hosting auto-builds and deploys on every push to the connected branch.

**Two backends are configured** (see [.firebaserc](./.firebaserc)):

| Project              | Use         |
| -------------------- | ----------- |
| `strojcek-staging`   | default dev |
| `strojcek-production`| live        |

[apphosting.yaml](./apphosting.yaml) is **shared between both projects** — per-environment values (Firebase Web config, project ID, app URL) come from each project's Cloud Secret Manager, so the same yaml resolves to the right config per backend.

### First-time backend setup

```bash
# 1. Upgrade project to Blaze (Firebase Console → Settings → Usage and billing).
#    App Hosting needs Blaze because it provisions Cloud Run + Cloud Build.

# 2. Create the App Hosting backend
firebase apphosting:backends:create --project strojcek-staging
#    → region: europe-west4 (or europe-west1)
#    → connect repo + branch

# 3. Push secrets to Cloud Secret Manager
./scripts/setup-apphosting-secrets.sh strojcek-staging

# 4. First deploy — git push triggers an auto-build
git push origin main
```

After the first deploy, copy the backend URL from the App Hosting console into `NEXT_PUBLIC_APP_URL` in Cloud Secret Manager (per project), and set the GitHub Actions repo secret `APP_URL` to the same value so cron workflows can hit it.

### Server credentials in production

`firebase-admin` uses **Application Default Credentials** on Cloud Run — the runtime identity is auto-bound, so `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are **not** needed in production. They live in `.env` only for local dev fallback.

## Cron

[.github/workflows/cron.yml](./.github/workflows/cron.yml) hits the production backend twice a day:

| When (UTC) | Endpoint              | What it does                                               |
| ---------- | --------------------- | ---------------------------------------------------------- |
| 16:00      | `/api/cron/reminders` | SMS + email reminders for tomorrow's appointments          |
| 03:00      | `/api/cron/cleanup`   | Mark stale `PENDING` appointments, prune old counter docs  |

Both endpoints require `Authorization: Bearer ${CRON_SECRET}`.

## Repo layout

```
src/
  app/            Next.js App Router routes (booking wizard, admin pages, API routes)
  server/
    actions/      server actions (mutations, all transactional where it matters)
    queries/      server-side Firestore reads → view models
    lib/          firebase-admin, auth, email, sms, telegram, firestore-utils
    types/        Firestore document shapes
  lib/            client-side: firebase-client, types, validators (zod), constants
scripts/          one-shot admin tasks (create-admin, seed, secret push)
docs/
  archive/        historical plans/specs from the pre-Firebase era — reference only
firestore.rules   security rules (admin-only writes, public read on services/barbers)
firestore.indexes.json
apphosting.yaml   App Hosting config (shared across staging/prod)
.firebaserc       project aliases
firebase.json     emulator + Firestore config
```

## Notes

- [Audit.md](./Audit.md) is a 45-item UI/UX audit (P0–P3 priorities) — consult before making UI changes.
- [docs/archive/2026-pre-firebase/](./docs/archive/2026-pre-firebase/) has the original implementation plans from the Postgres + Prisma + Better Auth era. Kept for history; **do not use them as a current guide.**
