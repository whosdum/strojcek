# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strojcek is a barber shop booking system with two parts: a public 5-step booking wizard for customers and an admin panel for the shop owner. It's a Next.js 16 monolith with PostgreSQL, built for a Slovak barber shop (UI text in Slovak, timezone Europe/Bratislava).

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npx prisma migrate dev   # Run database migrations
npx prisma generate      # Regenerate Prisma client (output: src/generated/prisma)
npx prisma db seed       # Seed database (runs prisma/seed.ts via tsx)
npx tsx scripts/create-admin.ts  # Create default admin user (admin@strojcek.sk / admin123)
```

## Architecture

### Route Groups

- `src/app/(public)/` — Public booking flow and cancellation
  - `/book` — 5-step wizard: service → barber → datetime → details → confirm
  - `/cancel` — Token-based appointment cancellation
- `src/app/(admin)/` — Admin panel (auth-protected)
  - `/login` — Better Auth email/password login
  - `/admin/*` — Dashboard, calendar, reservations, barbers, services, schedule, customers
- `src/app/api/` — API routes: auth handler, calendar data, booking summary, cron reminders

### Server Layer (`src/server/`)

- **actions/** — Server Actions for all mutations (booking, appointments, customers, barbers, services, schedules, slots)
- **queries/** — Server-side data fetching (read-only operations)
- **lib/** — Shared server utilities:
  - `prisma.ts` — Prisma client singleton using PrismaPg adapter with `pg.Pool`
  - `auth.ts` — Better Auth config (email/password, PostgreSQL backend)
  - `email.ts` — Resend integration for booking confirmations/reminders
  - `sms.ts` — SMStools.sk SMS notifications
  - `phone.ts` — Phone number normalization
  - `tokens.ts` — Cancellation token generation and hashing

### Client Layer (`src/lib/`)

- `auth-client.ts` — Better Auth React client
- `constants.ts` — Business rules: slot intervals (15min), buffer time (5min), cancel window (2h), page size (25), valid status transitions
- `validators.ts` — Zod schemas for all entities

### Components (`src/components/`)

- `ui/` — shadcn/ui primitives (base-nova style)
- `admin/` — Admin panel components (forms, tables, calendar, sidebar)
- `booking/` — Public booking wizard components (steps, service cards, time slots, summary)

### Database

PostgreSQL via Prisma with PrismaPg adapter. Prisma client is generated to `src/generated/prisma/`.

Key models: Barber, Service, BarberService (junction with custom pricing), Schedule, ScheduleOverride, ScheduleBreak, Customer, Appointment, AppointmentStatusHistory.

Appointment statuses: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED | CANCELLED | NO_SHOW. Valid transitions are defined in `src/lib/constants.ts`.

### Auth

Better Auth with email/password for admin users only. Auth guard lives in the admin layout (`src/app/(admin)/admin/layout.tsx`). Public booking requires no authentication — customers are identified by phone number.

## Key Patterns

- **Booking wizard state** is stored in URL search params, not client state
- **Prisma client** uses the `@prisma/adapter-pg` adapter with a `pg.Pool` — not the default Prisma connection
- **Prisma output** goes to `src/generated/prisma` (not node_modules)
- **Path alias**: `@/*` maps to `./src/*`
- **Email/SMS** send asynchronously with `.catch()` — failures don't block the user flow
- **Date handling**: all dates use `date-fns` + `date-fns-tz` with `Europe/Bratislava` timezone
- **Slot calculation**: 15-minute intervals grouped into morning (0-12), afternoon (12-16), evening (16-24)

## Environment Variables

See `.env.example` for all required variables. Key ones: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `SMSTOOLS_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`.
