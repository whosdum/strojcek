# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strojcek is a barber shop booking system with two parts: a public 5-step booking wizard for customers and an admin panel for the shop owner. It's a Next.js 16 monolith with PostgreSQL, built for a Slovak barber shop (UI text in Slovak, timezone Europe/Bratislava).

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Runs `prisma migrate deploy && prisma generate && next build` — migrations are applied on every build
npm run lint         # ESLint
npx prisma migrate dev   # Run database migrations (uses DIRECT_URL when set, falls back to DATABASE_URL — see prisma.config.ts)
npx prisma generate      # Regenerate Prisma client (output: src/generated/prisma)
npx prisma db seed       # Seed database (seed runner configured in prisma.config.ts → tsx prisma/seed.ts)
npx tsx scripts/create-admin.ts  # Create default admin user (admin@strojcek.sk / admin123)
```

## Architecture

### Route Groups

- `src/app/page.tsx` — Booking wizard (5-step: service → barber → datetime → details → confirm)
- `src/app/(public)/` — Public pages
  - `/cancel` — Token-based appointment cancellation
- `src/app/(admin)/` — Admin panel (auth-protected)
  - `/login` — Better Auth email/password login
  - `/admin/*` — Dashboard, calendar, reservations, barbers, services, schedule, customers
- `src/app/api/` — API routes: auth handler, calendar data, admin endpoints, cron jobs (`/api/cron/reminders`, `/api/cron/cleanup`)

### Server Layer (`src/server/`)

- **actions/** — Server Actions for all mutations (booking, appointments, customers, barbers, services, schedules, slots)
- **queries/** — Server-side data fetching (read-only operations)
- **lib/** — Shared server utilities:
  - `prisma.ts` — Prisma client singleton using PrismaPg adapter with `pg.Pool` (capped at `max: 1` for serverless). `getPool()` is shared with Better Auth to avoid duplicate connections
  - `auth.ts` — Better Auth config (email/password, PostgreSQL backend)
  - `email.ts` — Resend wrapper for booking confirmations/reminders (templates live in `src/emails/`)
  - `sms.ts` — SMStools.sk SMS notifications
  - `strings.ts` — `stripDiacritics()` — all SMS bodies go through this (SMSTools charges more for Unicode)
  - `telegram.ts` — admin push notifications on new bookings
  - `phone.ts` — Phone number normalization
  - `tokens.ts` — Cancellation token generation and hashing

### Client Layer (`src/lib/`)

- `auth-client.ts` — Better Auth React client
- `constants.ts` — Business rules: cancel window (`MIN_CANCEL_HOURS = 2`), page size (25), anti-spam limits (`GLOBAL_BOOKING_LIMIT = 30`, `PHONE_BOOKING_LIMIT_24H = 3`), slot group boundaries (morning 7–12, afternoon 12–17, evening 17–24), valid status transitions, `formatCurrency()`. Note: `SLOT_INTERVAL_MINUTES = 60` is only a fallback — the real value is read from the `ShopSettings` DB row at runtime
- `validators.ts` — Zod schemas for all entities

### Components (`src/components/`)

- `ui/` — shadcn/ui primitives (base-nova style)
- `admin/` — Admin panel components (forms, tables, calendar, sidebar)
- `booking/` — Public booking wizard components (steps, service cards, time slots, summary)

### Database

PostgreSQL via Prisma with PrismaPg adapter. Prisma client is generated to `src/generated/prisma/`.

Key models: Barber, Service, BarberService (junction with custom pricing/duration), Schedule, ScheduleOverride, ScheduleBreak, Customer, Appointment, AppointmentStatusHistory, ShopSettings.

Appointment statuses: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED | CANCELLED | NO_SHOW. Valid transitions are defined in `src/lib/constants.ts`.

Service-level settings live on the `Service` model: `durationMinutes`, `price`, and `bufferMinutes` (default 5) — buffer is per-service, not global.

### Auth

Better Auth with email/password for admin users only. Auth guard lives in the admin layout (`src/app/(admin)/admin/layout.tsx`). Public booking requires no authentication — customers are identified by phone number.

## Key Patterns

- **Booking wizard state** is stored in URL search params, not client state
- **Prisma client** uses the `@prisma/adapter-pg` adapter with a `pg.Pool` — not the default Prisma connection
- **Prisma output** goes to `src/generated/prisma` (not node_modules)
- **Migrations** require a direct (non-pooled) connection — `prisma.config.ts` reads `DIRECT_URL ?? DATABASE_URL`. Set `DIRECT_URL` when behind PgBouncer/Neon poolers
- **Path alias**: `@/*` maps to `./src/*`
- **Email/SMS/Telegram** send asynchronously with `.catch()` — failures don't block the user flow
- **Date handling**: all dates use `date-fns` + `date-fns-tz` with `Europe/Bratislava` timezone
- **Slot calculation**: interval is configurable per shop (`ShopSettings.slotIntervalMinutes`); slots are grouped into morning (7–12), afternoon (12–17), evening (17–24)
- **Cron jobs**: `.github/workflows/cron.yml` hits `/api/cron/reminders` daily at 16:00 UTC and `/api/cron/cleanup` at 03:00 UTC with `Authorization: Bearer $CRON_SECRET`. Both routes hard-fail with 401 if `CRON_SECRET` is unset

## Environment Variables

See `.env.example` for all required variables. Key ones: `DATABASE_URL`, `DIRECT_URL` (optional, for migrations behind a pooler), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `SMSTOOLS_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`.

## Other notes

- `Audit.md` is a 45-item UI/UX audit (P0–P3 priorities) — consult it before making UI changes to avoid re-introducing known issues.
