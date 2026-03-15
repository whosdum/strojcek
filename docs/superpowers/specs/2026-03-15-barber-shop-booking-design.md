# Barber Shop Booking System — Design Spec

## Overview

Complete reservation system for a barber shop. Two parts: public booking widget for customers and admin panel for the owner. Runs as a Next.js monolith (App Router) with PostgreSQL.

Inspiration for booking widget: https://services.bookio.com/strojcek/widget?lang=sk

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| ORM | Prisma (v7+) |
| Database | PostgreSQL |
| Auth | Better Auth (email/password for admin) |
| UI | Tailwind CSS + shadcn/ui |
| Validation | Zod (v4) |
| Forms | React Hook Form + Zod resolver |
| Dates | date-fns + date-fns-tz |
| Calendar (customer) | shadcn/ui Calendar (react-day-picker) |
| Calendar (admin) | FullCalendar React (free tier) |
| Email | Resend + React Email |
| SMS | GatewayAPI (REST API) |

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Booking wizard state | URL search params | Simple, bookmarkable, no extra dependency, native Next.js App Router support |
| Barber avatars | URL string input only | MVP simplicity — 1 barber initially, upload can be added later |
| Initial barbers | 1 (seed prepared for 3) | Real-world starting point |
| Deploy target | Portable — Vercel and Docker/Hetzner | API route + secret token for cron, no vendor lock-in |
| Cron for reminders | `/api/cron/reminders` with auth secret | Works with Vercel Cron config or system cron + curl |
| Email/SMS | Stubs first (console.log) | Real sending enabled via env variables when API keys are provided |
| "Any barber" option | Omitted for MVP | Only 1 barber initially |
| Photo upload | Omitted for MVP | Just URL field |
| SMS reminders | Omitted | Only email reminders |

## Project Structure

```
src/
├── app/
│   ├── (public)/
│   │   ├── book/                  # Booking widget (public)
│   │   │   ├── page.tsx           # Landing / service selection
│   │   │   ├── barber/page.tsx    # Barber selection
│   │   │   ├── datetime/page.tsx  # Date and time selection
│   │   │   ├── details/page.tsx   # Customer contact details
│   │   │   └── confirm/page.tsx   # Confirmation + success
│   │   └── cancel/page.tsx        # Cancellation via token from email/SMS
│   ├── (admin)/
│   │   ├── layout.tsx             # Admin layout + auth guard
│   │   ├── admin/
│   │   │   ├── page.tsx           # Dashboard (today's reservations)
│   │   │   ├── calendar/page.tsx  # Calendar view (FullCalendar)
│   │   │   ├── reservations/      # List + detail + edit reservations
│   │   │   ├── barbers/           # CRUD barbers
│   │   │   ├── services/          # CRUD services
│   │   │   ├── schedule/          # Working hours management
│   │   │   └── customers/         # Customer records
│   │   └── login/page.tsx         # Admin login
│   └── api/
│       ├── auth/[...all]/route.ts # Better Auth API routes
│       └── cron/reminders/route.ts # Reminder cron endpoint
├── server/
│   ├── actions/                   # Server Actions
│   │   ├── booking.ts             # createBooking, cancelBooking
│   │   ├── barbers.ts             # CRUD
│   │   ├── services.ts            # CRUD
│   │   ├── schedules.ts           # CRUD + overrides
│   │   ├── appointments.ts        # Admin appointment management
│   │   └── customers.ts           # Customer management
│   ├── queries/                   # Server-side data fetching
│   │   ├── slots.ts               # getAvailableSlots()
│   │   ├── appointments.ts        # Appointment queries
│   │   ├── tokens.ts              # getAppointmentByToken()
│   │   └── customers.ts           # Customer queries
│   └── lib/
│       ├── auth.ts                # Better Auth config
│       ├── prisma.ts              # Prisma client singleton
│       ├── email.ts               # Resend wrapper (stub-capable)
│       ├── sms.ts                 # GatewayAPI wrapper (stub-capable)
│       ├── tokens.ts              # Cancellation token generation + hashing
│       └── phone.ts               # Phone number normalization
├── components/
│   ├── booking/                   # Booking widget components
│   ├── admin/                     # Admin components
│   └── ui/                        # shadcn/ui
├── emails/                        # React Email templates
│   ├── booking-confirmation.tsx
│   ├── booking-reminder.tsx
│   └── booking-cancellation.tsx
├── lib/
│   ├── validators.ts              # Zod schemas
│   ├── types.ts                   # Shared TypeScript types
│   ├── constants.ts               # Named constants (MIN_CANCEL_HOURS, SLOT_INTERVAL, etc.)
│   └── utils.ts                   # Utility functions
└── prisma/
    ├── schema.prisma
    ├── seed.ts                    # Seed data
    └── migrations/
```

## Database Model (Prisma Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Barber {
  id        String   @id @default(uuid())
  firstName String   @map("first_name")
  lastName  String   @map("last_name")
  email     String?  @unique
  phone     String?
  bio       String?
  avatarUrl String?  @map("avatar_url")
  isActive  Boolean  @default(true) @map("is_active")
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  services          BarberService[]
  schedules         Schedule[]
  scheduleOverrides ScheduleOverride[]
  scheduleBreaks    ScheduleBreak[]
  appointments      Appointment[]

  @@map("barbers")
}

model Service {
  id              String   @id @default(uuid())
  name            String   @unique
  description     String?
  durationMinutes Int      @map("duration_minutes")
  price           Decimal  @db.Decimal(10, 2)
  bufferMinutes   Int      @default(5) @map("buffer_minutes")
  isActive        Boolean  @default(true) @map("is_active")
  sortOrder       Int      @default(0) @map("sort_order")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  barbers      BarberService[]
  appointments Appointment[]

  @@map("services")
}

model BarberService {
  barberId       String   @map("barber_id")
  serviceId      String   @map("service_id")
  customPrice    Decimal? @map("custom_price") @db.Decimal(10, 2)
  customDuration Int?     @map("custom_duration_minutes")

  barber  Barber  @relation(fields: [barberId], references: [id])
  service Service @relation(fields: [serviceId], references: [id])

  @@id([barberId, serviceId])
  @@map("barber_services")
}

model Schedule {
  id        String  @id @default(uuid())
  barberId  String  @map("barber_id")
  dayOfWeek Int     @map("day_of_week") // 0=Sunday..6=Saturday
  startTime String  @map("start_time") // "09:00" (HH:mm string)
  endTime   String  @map("end_time")   // "17:00" (HH:mm string)
  isActive  Boolean @default(true) @map("is_active")

  barber Barber @relation(fields: [barberId], references: [id])

  @@map("schedules")
}

model ScheduleOverride {
  id           String   @id @default(uuid())
  barberId     String   @map("barber_id")
  overrideDate DateTime @map("override_date") @db.Date
  isAvailable  Boolean  @default(false) @map("is_available")
  startTime    String?  @map("start_time") // "10:00" (HH:mm string)
  endTime      String?  @map("end_time")   // "14:00" (HH:mm string)
  reason       String?

  barber Barber @relation(fields: [barberId], references: [id])

  @@unique([barberId, overrideDate])
  @@map("schedule_overrides")
}

model ScheduleBreak {
  id        String @id @default(uuid())
  barberId  String @map("barber_id")
  dayOfWeek Int    @map("day_of_week")
  startTime String @map("start_time") // "12:00" (HH:mm string)
  endTime   String @map("end_time")   // "12:30" (HH:mm string)
  label     String @default("Prestavka")

  barber Barber @relation(fields: [barberId], references: [id])

  @@unique([barberId, dayOfWeek, startTime])
  @@map("schedule_breaks")
}

model Customer {
  id         String   @id @default(uuid())
  firstName  String   @map("first_name")
  lastName   String?  @map("last_name")
  phone      String   @unique
  email      String?
  notes      String?
  visitCount Int      @default(0) @map("visit_count")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  appointments Appointment[]

  @@map("customers")
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}

model Appointment {
  id                 String            @id @default(uuid())
  barberId           String            @map("barber_id")
  customerId         String?           @map("customer_id")
  serviceId          String            @map("service_id")
  startTime          DateTime          @map("start_time")
  endTime            DateTime          @map("end_time")
  status             AppointmentStatus @default(PENDING)
  priceExpected      Decimal           @map("price_expected") @db.Decimal(10, 2)
  priceFinal         Decimal?          @map("price_final") @db.Decimal(10, 2)
  customerName       String?           @map("customer_name")
  customerPhone      String?           @map("customer_phone")
  customerEmail      String?           @map("customer_email")
  cancellationToken  String?           @unique @map("cancellation_token")
  cancellationReason String?           @map("cancellation_reason")
  notes              String?
  source             String            @default("online") // "online" | "admin" | "phone"
  reminderSentAt     DateTime?         @map("reminder_sent_at")
  createdAt          DateTime          @default(now()) @map("created_at")
  updatedAt          DateTime          @updatedAt @map("updated_at")

  barber        Barber                     @relation(fields: [barberId], references: [id])
  customer      Customer?                  @relation(fields: [customerId], references: [id])
  service       Service                    @relation(fields: [serviceId], references: [id])
  statusHistory AppointmentStatusHistory[]

  @@index([barberId, startTime])
  @@map("appointments")
}

model AppointmentStatusHistory {
  id            String             @id @default(uuid())
  appointmentId String             @map("appointment_id")
  oldStatus     AppointmentStatus? @map("old_status")
  newStatus     AppointmentStatus  @map("new_status")
  changedBy     String?            @map("changed_by")
  reason        String?
  changedAt     DateTime           @default(now()) @map("changed_at")

  appointment Appointment @relation(fields: [appointmentId], references: [id])

  @@map("appointment_status_history")
}
```

### Field Type Clarifications

- **Schedule/ScheduleBreak/ScheduleOverride `startTime`/`endTime`**: Stored as `String` in `"HH:mm"` format (e.g., "09:00", "17:00"). These represent time-of-day, not timestamps. Parsed via `date-fns` for slot calculation.
- **Appointment `startTime`/`endTime`**: Stored as `DateTime` (TIMESTAMPTZ in PostgreSQL, UTC). These are full timestamps.
- **`price`/`customPrice`**: `Decimal(10,2)` — exact currency representation.
- **`dayOfWeek`**: `Int` — 0=Sunday through 6=Saturday (matches JavaScript `Date.getDay()`).
- **`source`**: `String` with values `"online"`, `"admin"`, or `"phone"`. Not an enum to keep it simple.

### Buffer Time Handling

**`Appointment.endTime` = startTime + serviceDuration (WITHOUT buffer).**

Buffer is enforced only at the application level during slot calculation. The DB exclusion constraint is a safety net against exact time overlaps only — it does NOT enforce buffer gaps. The app-level check in `createBooking` (SELECT FOR UPDATE) and the slot algorithm are the primary buffer enforcers. This means:
- Customer sees: "14:00 - 14:30" (actual service time)
- Slot calculator blocks: 14:00 - 14:35 (service + 5min buffer)
- Next available slot: 14:45 (next 15min interval after 14:35)
- DB constraint prevents: another appointment starting at 14:15 (overlaps 14:00-14:30)
- DB constraint does NOT prevent: appointment at 14:30 (no raw overlap, but violates buffer) — app-level check catches this

### BarberService Fallback Logic

- If `customDuration` is null → use `Service.durationMinutes`
- If `customPrice` is null → use `Service.price`
- `Appointment.priceExpected` uses the effective price at booking time

### Exclusion Constraint (Raw SQL Migration)

After the initial `prisma migrate dev`, create a second migration with raw SQL:

```bash
prisma migrate dev --create-only --name add_exclusion_constraint
```

Then edit the generated SQL file:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING GIST (
    barber_id WITH =,
    TSTZRANGE(start_time, end_time) WITH &&
  )
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
```

Note: Column names use `@map` snake_case names (`barber_id`, `start_time`, `end_time`). The `status` column stores the enum as a PostgreSQL enum type — the `NOT IN` comparison works with enum values.

### Better Auth Tables

Better Auth manages its own tables (`user`, `session`, `account`, `verification`) separately from Prisma. These are NOT in `schema.prisma`. Better Auth creates them automatically on first run. When running `prisma migrate`, use `prisma migrate diff` awareness or `prisma db push` won't conflict because Prisma only manages its own models.

## Core Logic: Available Slots Calculation

Slots are NEVER stored in the database — computed dynamically per request.

**Algorithm for `getAvailableSlots(barberId, serviceId, date)`:**

1. Check `schedule_overrides` for the date:
   - Override with `isAvailable=false` → no slots (day off)
   - Override with `isAvailable=true` → use its startTime/endTime. **Regular breaks do NOT apply on override days** — the override defines the complete schedule for that day.
   - No override → continue to step 2
2. Load regular `schedule` for the date's dayOfWeek
   - None or `isActive=false` → no slots
3. Load `schedule_breaks` for that dayOfWeek (only for regular schedule days, not overrides)
4. Load all active appointments (status != CANCELLED, NO_SHOW) for the barber on that date. **Include each appointment's service buffer** (join through `Service` or `BarberService`) — needed for overlap checking in step 7.
5. Get effective service duration and buffer for the service being booked:
   - Check `barber_services` for custom values
   - Fall back to `Service.durationMinutes` and `Service.bufferMinutes`
6. Generate candidates in 15-minute intervals from working day startTime to endTime
7. For each candidate (start):
   - Calculate slotEnd = start + duration
   - Calculate blockEnd = start + duration + buffer
   - Check: slotEnd fits within working hours?
   - Check: [start, slotEnd] doesn't overlap with a break?
   - Check: [start, blockEnd] doesn't overlap with existing appointment's [startTime, endTime + buffer]?
   - All OK → slot is available
8. Return array of available start times

**Rules:**
- All times stored as TIMESTAMPTZ (UTC in DB)
- Display converted to `Europe/Bratislava` via `date-fns-tz`
- 15-minute step interval (salon standard)
- Past times (today before current time) automatically excluded

## Phone Number Normalization

All phone numbers are normalized before storage and lookup:
- Strip all spaces, dashes, parentheses
- Convert leading `0` to `+421` (Slovak numbers)
- Store in E.164 format: `+421XXXXXXXXX`
- Normalization happens in `server/lib/phone.ts` and is applied:
  - On customer creation/lookup in `createBooking`
  - On customer search in admin panel
  - In Zod validators

## Appointment Status Transitions

```
PENDING ──→ CONFIRMED ──→ IN_PROGRESS ──→ COMPLETED
  │             │              │
  │             │              ├──→ NO_SHOW
  │             │              │
  ├──→ CANCELLED ←─────────────┘
  │             ↑
  └─────────────┘

Valid transitions:
  PENDING     → CONFIRMED, CANCELLED
  CONFIRMED   → IN_PROGRESS, CANCELLED, NO_SHOW
  IN_PROGRESS → COMPLETED, CANCELLED, NO_SHOW
  COMPLETED   → (terminal state, no transitions)
  CANCELLED   → (terminal state, no transitions)
  NO_SHOW     → (terminal state, no transitions)
```

**Customer cancellation** (via token): Allowed from PENDING, CONFIRMED, or IN_PROGRESS — but only if `startTime` is at least 2 hours in the future. The 2-hour minimum is defined as `MIN_CANCEL_HOURS = 2` in `lib/constants.ts`.

**Admin cancellation**: Allowed from PENDING, CONFIRMED, or IN_PROGRESS — no time restriction.

**`visitCount` increment**: Only on transition to COMPLETED. No decrement — COMPLETED is a terminal state.

## Booking Widget — 5-Step Wizard

State passed between steps via URL search params.

### Step 1: Service Selection (`/book`)
- Service cards: name, duration, price
- Click → navigate to step 2 with `serviceId` param

### Step 2: Barber Selection (`/book/barber?serviceId=...`)
- Barber cards: photo, name, bio
- Filtered to barbers offering the selected service
- Click → navigate to step 3

### Step 3: Date & Time (`/book/datetime?serviceId=...&barberId=...`)
- shadcn/ui Calendar for date selection
- Disabled dates: past + days barber doesn't work
- After date selection: fetch available slots via Server Action
- Slots displayed as tappable chip buttons, grouped:
  - **Rano (Morning)**: before 12:00
  - **Poobede (Afternoon)**: 12:00 - 16:00
  - **Vecer (Evening)**: 16:00+
- Min 44px touch targets (mobile-first)
- Loading skeleton while slots are being fetched
- Empty state message if no slots available for selected date

### Step 4: Contact Details (`/book/details?serviceId=...&barberId=...&date=...&time=...`)
- Form: Name (required), Surname, Phone (required, +421 prefix), Email (required)
- Optional: note
- Validation via Zod + React Hook Form
- Phone input with +421 prefix handling and normalization

### Step 5: Confirmation (`/book/confirm?...`)
- Summary: service, barber, date, time, price
- Cancellation policy info (min 2h before appointment)
- "Confirm Reservation" button → Server Action `createBooking`
- Loading state on button during submission
- On success: success screen with reference number
- On conflict (slot taken): error message with link back to datetime selection

### `createBooking` Server Action:
1. Validate input via Zod
2. Normalize phone number
3. Find or create customer by normalized phone number (upsert: update name/email if customer exists — intentional for MVP, returning customers get their info updated)
4. Prisma transaction:
   a. Verify slot still available (SELECT FOR UPDATE on overlapping appointments)
   b. INSERT appointment with generated cancellation_token (crypto.randomBytes(32))
   c. Store only SHA-256 hash of token in DB
   d. Set `priceExpected` from effective price (barber custom or service default)
   e. Set status to CONFIRMED (online bookings are auto-confirmed — no manual gate for a 1-barber shop)
   f. INSERT into appointment_status_history (oldStatus: null, newStatus: CONFIRMED)
5. Send confirmation email (Resend stub) — includes reservation details + cancel link
6. Send confirmation SMS (GatewayAPI stub) — short message with details + cancel link
7. Return success + booking reference (appointment ID or short code)

## Cancellation Flow

Customer clicks `/cancel?token=xxx` from email/SMS.

### Page Load (Server Component):
1. Hash token from URL (SHA-256)
2. Query appointment via `getAppointmentByToken(hashedToken)` in `server/queries/tokens.ts`
3. If not found → error screen ("Invalid or expired link")
4. If found → display reservation details (service, barber, date, time)

### Cancel Action:
1. "Cancel Reservation" button
2. Server Action `cancelBooking`:
   a. Hash token from URL (SHA-256), compare with stored hash
   b. Verify: appointment status is PENDING, CONFIRMED, or IN_PROGRESS
   c. Verify: appointment.startTime is min 2h in future (`MIN_CANCEL_HOURS`)
   d. Update status to CANCELLED
   e. Write to appointment_status_history
   f. Send cancellation confirmation email
3. Success/error screen

## Notifications

### Email (Resend + React Email) — Stub Implementation
3 template types, all console.log initially. Real sending when `RESEND_API_KEY` env var present.

1. **Booking confirmation** — sent immediately after booking creation
2. **Reminder** — sent 24h before appointment via cron job
3. **Cancellation confirmation** — sent immediately after cancellation

### SMS (GatewayAPI) — Stub Implementation
1 type only: booking confirmation. Console.log initially. Real sending when `GATEWAYAPI_TOKEN` env var present.

### Cron Job (`/api/cron/reminders`)
- Runs every hour
- Finds appointments where startTime is 23-25 hours away and `reminderSentAt` is null
- Only processes appointments with status CONFIRMED (not CANCELLED/NO_SHOW/COMPLETED/IN_PROGRESS — if already in progress, a reminder is moot)
- Sends reminder email, sets `reminderSentAt`
- Protected by `CRON_SECRET` env variable (compared via `Authorization: Bearer <secret>`)
- Compatible with both Vercel Cron and system cron + curl

## Admin Panel

Behind Better Auth authentication (email/password). Route group `(admin)` with layout.tsx checking session.

### Dashboard (`/admin`)
- Today's reservations (count + list)
- Upcoming appointments
- Simple stats: day occupancy, no-show rate

### Calendar (`/admin/calendar`)
- FullCalendar React — day and week views
- Color-coded blocks per barber
- Click empty slot → modal with simplified booking form (barber pre-selected from column, date/time pre-selected from slot, fields: service dropdown, customer name, phone, email, note). Source set to "admin".
- Click existing → detail with edit/cancel options

### Reservations (`/admin/reservations`)
- shadcn/ui DataTable (TanStack Table)
- Columns: date, time, customer, barber, service, status
- Filters: date range, barber, status
- Server-side pagination (25 items per page)
- Row click → detail view with actions:
  - Confirm (PENDING → CONFIRMED)
  - Mark IN_PROGRESS (CONFIRMED → IN_PROGRESS)
  - Complete (→ COMPLETED, increment customer visitCount)
  - Cancel (→ CANCELLED, no time restriction for admin)
  - No-show (→ NO_SHOW)
  - Edit notes, time, barber

### Barbers (`/admin/barbers`)
- CRUD: name, surname, email, phone, bio, avatar URL
- Service assignment (checkboxes) with optional custom price/duration
- Active/inactive toggle
- Sort order

### Services (`/admin/services`)
- CRUD: name, description, duration (minutes), price (EUR), buffer (minutes)
- Active/inactive toggle
- Sort order

### Schedule (`/admin/schedule`)
- Visual table: rows = days of week, columns = barber
- Per day/barber: start/end time settings
- Break management (label, start, end per day)
- Schedule overrides: exceptions (vacation, sick day, custom hours for specific date)

### Customers (`/admin/customers`)
- List with search (name, phone, email)
- Server-side pagination (25 items per page)
- Customer detail: contact info, visit count, full booking history, editable notes
- Manual customer creation

## Authentication

Better Auth with email/password. Creates its own tables (`user`, `session`, `account`, `verification`) — managed by Better Auth, NOT in Prisma schema. Admin layout middleware checks session — redirect to `/login` if not authenticated. Single admin account via seed.

## Technical Rules

- **Timezone**: All times as TIMESTAMPTZ (UTC in DB), display in `Europe/Bratislava`
- **Double-booking**: Primary = DB exclusion constraint, Secondary = app-level check in transaction
- **Cancellation token**: `crypto.randomBytes(32).toString('hex')`, SHA-256 hash in DB, raw in email/SMS
- **Mobile-first**: 44px+ touch targets, full-width on small screens, chip buttons not dropdowns
- **Error handling**: try/catch on every Server Action, Zod on every input, Slovak error messages for customers
- **Language**: Customer-facing UI in Slovak, admin panel in Slovak
- **Constants**: Named constants in `lib/constants.ts` for `MIN_CANCEL_HOURS`, `SLOT_INTERVAL_MINUTES`, `DEFAULT_BUFFER_MINUTES`, slot grouping boundaries, pagination page size

## Seed Data

Initial data — all editable via admin panel after setup.

### Barbers
- 3 barbers (Martin, Jakub, Peter)

### Services (from real Strojcek offering)

| Name | Duration | Price | Description |
|------|----------|-------|-------------|
| Pansky strih | 60 min | 18 EUR | Kompletny pansky strih zahrna osobnu konzultaciu, strih podla vasho stylu, umytie vlasov a finalny styling. Profesionalna starostlivost a fresh cut. |
| Pansky strih a uprava brady | 90 min | 23 EUR | Komplexna starostlivost o vlasy aj bradu. Zahrna konzultaciu, presny strih, umytie vlasov, upravu brady alebo kontur a profesionalny styling. Perfektne upraveny vzhlad v jednej sluzbe. |
| Strojcek Ritual – kompletny strih, brada, vosk a hot towel | 90 min | 30 EUR | Zazite kompletnu starostlivost o vlasy a bradu – od presneho strihu a umytia vlasov, cez upravu brady alebo kontur, az po profesionalny styling. Sucastou je aj depilacia voskom, relaxacny zabal horucim utorakom a tradicne turecke opalovanie usi. Vsetko v jednej sluzbe pre perfektne upraveny vzhlad a pocit absolutnej starostlivosti. |
| Uprava brady | 30 min | 15 EUR | Uprava brady na mieru – od jemneho zastrihnutia az po presne, ostre linie. Zameriavame sa na detail, symetriu a cisty finish. Sviezi, moderny vzhlad, ktory zvyrazni tvoj styl. |
| Studentsky strih | 60 min | 15 EUR | Zvyhodneny studentsky strih obsahuje strih na mieru a finalnu upravu. Profesionalny pristup, fresh look a prijemna atmosfera. Zlava plati po predlozeni studentskeho preukazu. |

### Schedule (editable via admin panel)
- Working hours: Mon-Fri 9:00-17:00, Sat 9:00-13:00
- Lunch break: 12:00-12:30
- All working hours, breaks, and overrides are fully manageable in `/admin/schedule`

### Other
- Service-barber assignments (all barbers offer all services)
- 1 admin account (admin@barbershop.sk / changeme123)

## Environment Variables

```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=re_...              # optional for stubs
EMAIL_FROM="Barber Shop <bookings@tvoja-domena.sk>"
GATEWAYAPI_TOKEN=...               # optional for stubs
CRON_SECRET=...                    # secret for cron endpoint auth
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHOP_NAME="Barber Shop"
NEXT_PUBLIC_SHOP_TIMEZONE="Europe/Bratislava"
```

## Out of Scope (MVP)

- Google Calendar sync
- Walk-in queue
- Analytics dashboard with charts
- Multi-location support
- Loyalty program
- "Any barber" option
- Customer registration / customer accounts
- Push notifications
- Photo upload (just URL field)
- SMS reminders (email only)
- Rate limiting (defer to post-MVP)
