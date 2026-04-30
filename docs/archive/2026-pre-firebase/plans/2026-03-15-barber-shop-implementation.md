# Barber Shop Booking System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete reservation system for Strojcek barber shop with public booking widget and admin panel.

**Architecture:** Next.js 16 App Router monolith with PostgreSQL. Server Actions for mutations, Server Components for data fetching. Prisma ORM. Better Auth for admin authentication.

**Tech Stack:** Next.js 16, TypeScript, Prisma, PostgreSQL, Better Auth, Tailwind CSS, shadcn/ui, Zod v4, React Hook Form, date-fns, FullCalendar, Resend, GatewayAPI

**Spec:** `docs/superpowers/specs/2026-03-15-barber-shop-booking-design.md`

---

## Chunk 1: Project Setup & Database

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create Next.js app**
Run: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*"`

- [ ] **Step 2: Install all dependencies**
```bash
# ORM
npm i prisma @prisma/client

# Auth
npm i better-auth

# UI
npm i @radix-ui/react-icons class-variance-authority clsx tailwind-merge lucide-react

# Validation & Forms
npm i zod @hookform/resolvers react-hook-form

# Dates
npm i date-fns date-fns-tz

# Calendar (admin)
npm i @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction

# Email
npm i resend @react-email/components react-email

# Table
npm i @tanstack/react-table

# Dev
npm i -D prisma tsx
```

- [ ] **Step 3: Initialize shadcn/ui**
Run: `npx shadcn@latest init`
Then add components: `npx shadcn@latest add button card input label select textarea dialog table calendar badge separator dropdown-menu sheet tabs toast popover command form checkbox switch`

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: scaffold Next.js project with all dependencies"
```

### Task 2: Prisma Schema & Migrations

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env` (template)

- [ ] **Step 1: Create .env file**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/strojcek?schema=public"
BETTER_AUTH_SECRET="development-secret-change-in-production"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SHOP_NAME="Strojcek"
NEXT_PUBLIC_SHOP_TIMEZONE="Europe/Bratislava"
```

- [ ] **Step 2: Create .env.example** (same as .env but with placeholder values)

- [ ] **Step 3: Write Prisma schema** (copy from spec lines 109-281)

- [ ] **Step 4: Run initial migration**
```bash
npx prisma migrate dev --name init
```

- [ ] **Step 5: Create exclusion constraint migration**
```bash
npx prisma migrate dev --create-only --name add_exclusion_constraint
```
Edit the generated SQL migration file to contain:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING GIST (
    barber_id WITH =,
    TSTZRANGE(start_time, end_time) WITH &&
  )
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
```
Then: `npx prisma migrate dev`

- [ ] **Step 6: Create Prisma client singleton**
File: `src/server/lib/prisma.ts`

- [ ] **Step 7: Commit**

### Task 3: Shared Libraries

**Files:**
- Create: `src/lib/constants.ts`
- Create: `src/lib/utils.ts`
- Create: `src/lib/validators.ts`
- Create: `src/server/lib/phone.ts`
- Create: `src/server/lib/tokens.ts`

- [ ] **Step 1: Create constants.ts** with MIN_CANCEL_HOURS, SLOT_INTERVAL_MINUTES, DEFAULT_BUFFER_MINUTES, slot grouping boundaries, PAGE_SIZE
- [ ] **Step 2: Create utils.ts** with cn() helper
- [ ] **Step 3: Create phone.ts** with normalizePhone() — strip formatting, convert leading 0 to +421
- [ ] **Step 4: Create tokens.ts** with generateToken() and hashToken() using crypto
- [ ] **Step 5: Create validators.ts** with Zod schemas for booking input, customer input, service input, barber input, schedule input
- [ ] **Step 6: Commit**

### Task 4: Seed Script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add prisma.seed config)

- [ ] **Step 1: Write seed.ts** — 3 barbers, 5 real Strojcek services, schedules (Mon-Fri 9-17, Sat 9-13), lunch breaks (12:00-12:30), barber-service assignments
- [ ] **Step 2: Add seed config to package.json**: `"prisma": { "seed": "tsx prisma/seed.ts" }`
- [ ] **Step 3: Run seed**: `npx prisma db seed`
- [ ] **Step 4: Commit**

## Chunk 2: Auth & Email/SMS Stubs

### Task 5: Better Auth Setup

**Files:**
- Create: `src/server/lib/auth.ts`
- Create: `src/server/lib/auth-client.ts`
- Create: `src/app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Create auth.ts** — Better Auth server config with Prisma adapter, emailAndPassword enabled
- [ ] **Step 2: Create auth-client.ts** — Better Auth client for use in React components
- [ ] **Step 3: Create API route** — catch-all route handler for Better Auth
- [ ] **Step 4: Commit**

### Task 6: Email & SMS Stubs

**Files:**
- Create: `src/server/lib/email.ts`
- Create: `src/server/lib/sms.ts`
- Create: `src/emails/booking-confirmation.tsx`
- Create: `src/emails/booking-reminder.tsx`
- Create: `src/emails/booking-cancellation.tsx`

- [ ] **Step 1: Create email.ts** — Resend wrapper with stub fallback (console.log when no RESEND_API_KEY)
- [ ] **Step 2: Create sms.ts** — GatewayAPI wrapper with stub fallback (console.log when no GATEWAYAPI_TOKEN)
- [ ] **Step 3: Create email templates** — React Email components for confirmation, reminder, cancellation
- [ ] **Step 4: Commit**

## Chunk 3: Core Backend Logic

### Task 7: Available Slots Calculation

**Files:**
- Create: `src/server/queries/slots.ts`

- [ ] **Step 1: Implement getAvailableSlots(barberId, serviceId, date)**
Following the 8-step algorithm from spec:
1. Check schedule_overrides
2. Load regular schedule
3. Load breaks (only for non-override days)
4. Load active appointments with service buffer
5. Get effective duration + buffer
6. Generate 15-min interval candidates
7. Filter: fits in working hours, no break overlap, no appointment overlap
8. Return available start times

- [ ] **Step 2: Implement getBarberWorkingDays(barberId, startDate, endDate)** — returns dates where barber has a schedule (for calendar disabled days)
- [ ] **Step 3: Commit**

### Task 8: Booking Server Actions

**Files:**
- Create: `src/server/actions/booking.ts`
- Create: `src/server/queries/tokens.ts`

- [ ] **Step 1: Implement createBooking server action**
1. Zod validate input
2. Normalize phone
3. Upsert customer by phone
4. Prisma transaction: verify slot available, insert appointment with hashed token, insert status history
5. Send confirmation email + SMS (stubs)
6. Return success with booking reference

- [ ] **Step 2: Implement cancelBooking server action**
1. Hash token, find appointment
2. Verify status is cancellable
3. Verify min 2h before start
4. Update status to CANCELLED
5. Insert status history
6. Send cancellation email

- [ ] **Step 3: Implement getAppointmentByToken query** in `src/server/queries/tokens.ts`
- [ ] **Step 4: Commit**

### Task 9: Appointment Queries & Actions

**Files:**
- Create: `src/server/queries/appointments.ts`
- Create: `src/server/actions/appointments.ts`

- [ ] **Step 1: Create appointment queries** — getTodayAppointments, getAppointments (paginated, filtered), getAppointmentById, getUpcoming
- [ ] **Step 2: Create admin appointment actions** — updateAppointmentStatus (with transition validation), updateAppointment (notes, time, barber)
- [ ] **Step 3: Commit**

## Chunk 4: Booking Widget

### Task 10: Booking Layout & Step 1 (Services)

**Files:**
- Create: `src/app/(public)/book/layout.tsx`
- Create: `src/app/(public)/book/page.tsx`
- Create: `src/components/booking/service-card.tsx`
- Create: `src/components/booking/booking-steps.tsx`
- Create: `src/server/queries/services.ts`

- [ ] **Step 1: Create booking layout** with step indicator
- [ ] **Step 2: Create service query** — getActiveServices()
- [ ] **Step 3: Create ServiceCard component** — name, duration, price, description
- [ ] **Step 4: Create Step 1 page** — grid of service cards, click navigates to /book/barber?serviceId=X
- [ ] **Step 5: Commit**

### Task 11: Step 2 (Barber Selection)

**Files:**
- Create: `src/app/(public)/book/barber/page.tsx`
- Create: `src/components/booking/barber-card.tsx`
- Create: `src/server/queries/barbers.ts`

- [ ] **Step 1: Create barber query** — getBarbersByService(serviceId)
- [ ] **Step 2: Create BarberCard component** — avatar, name, bio
- [ ] **Step 3: Create Step 2 page** — filtered barber cards, click navigates to /book/datetime?serviceId=X&barberId=Y
- [ ] **Step 4: Commit**

### Task 12: Step 3 (Date & Time)

**Files:**
- Create: `src/app/(public)/book/datetime/page.tsx`
- Create: `src/components/booking/time-slots.tsx`
- Create: `src/components/booking/slot-chip.tsx`

- [ ] **Step 1: Create TimeSlots component** — groups slots into Morning/Afternoon/Evening, renders SlotChip buttons
- [ ] **Step 2: Create SlotChip component** — 44px min touch target, selected state
- [ ] **Step 3: Create Step 3 page** — Calendar + TimeSlots, fetches slots on date change via server action
- [ ] **Step 4: Commit**

### Task 13: Step 4 (Contact Details)

**Files:**
- Create: `src/app/(public)/book/details/page.tsx`
- Create: `src/components/booking/contact-form.tsx`

- [ ] **Step 1: Create ContactForm** — React Hook Form + Zod, fields: name, surname, phone (+421), email, note
- [ ] **Step 2: Create Step 4 page** — renders form, on submit navigates to /book/confirm with all params
- [ ] **Step 3: Commit**

### Task 14: Step 5 (Confirmation) & Cancel Page

**Files:**
- Create: `src/app/(public)/book/confirm/page.tsx`
- Create: `src/components/booking/booking-summary.tsx`
- Create: `src/app/(public)/cancel/page.tsx`
- Create: `src/components/booking/cancel-form.tsx`

- [ ] **Step 1: Create BookingSummary component** — displays service, barber, date, time, price
- [ ] **Step 2: Create Step 5 page** — summary + confirm button, calls createBooking, shows success/error
- [ ] **Step 3: Create Cancel page** — loads appointment by token, shows details, cancel button calls cancelBooking
- [ ] **Step 4: Commit**

## Chunk 5: Admin Panel — Foundation & CRUD

### Task 15: Admin Layout & Login

**Files:**
- Create: `src/app/(admin)/layout.tsx`
- Create: `src/app/(admin)/login/page.tsx`
- Create: `src/components/admin/sidebar.tsx`
- Create: `src/components/admin/admin-nav.tsx`

- [ ] **Step 1: Create login page** — email/password form using Better Auth client
- [ ] **Step 2: Create admin layout** — auth guard (redirect to /login if no session), sidebar nav
- [ ] **Step 3: Create sidebar component** — links to dashboard, calendar, reservations, barbers, services, schedule, customers
- [ ] **Step 4: Commit**

### Task 16: Admin Dashboard

**Files:**
- Create: `src/app/(admin)/admin/page.tsx`
- Create: `src/components/admin/today-appointments.tsx`
- Create: `src/components/admin/stats-cards.tsx`

- [ ] **Step 1: Create dashboard page** — today's appointments list, upcoming, simple stats (occupancy, no-show rate)
- [ ] **Step 2: Commit**

### Task 17: Barbers CRUD

**Files:**
- Create: `src/app/(admin)/admin/barbers/page.tsx`
- Create: `src/app/(admin)/admin/barbers/[id]/page.tsx`
- Create: `src/components/admin/barber-form.tsx`
- Create: `src/server/actions/barbers.ts`

- [ ] **Step 1: Create barber server actions** — createBarber, updateBarber, toggleBarberActive
- [ ] **Step 2: Create barber list page** — table with name, email, active status, actions
- [ ] **Step 3: Create barber form component** — name, surname, email, phone, bio, avatar URL, service assignments with custom price/duration
- [ ] **Step 4: Create barber detail/edit page**
- [ ] **Step 5: Commit**

### Task 18: Services CRUD

**Files:**
- Create: `src/app/(admin)/admin/services/page.tsx`
- Create: `src/components/admin/service-form.tsx`
- Create: `src/server/actions/services.ts`

- [ ] **Step 1: Create service server actions** — createService, updateService, toggleServiceActive
- [ ] **Step 2: Create services page** — table + dialog form for create/edit
- [ ] **Step 3: Commit**

### Task 19: Schedule Management

**Files:**
- Create: `src/app/(admin)/admin/schedule/page.tsx`
- Create: `src/components/admin/schedule-table.tsx`
- Create: `src/components/admin/break-manager.tsx`
- Create: `src/components/admin/override-manager.tsx`
- Create: `src/server/actions/schedules.ts`

- [ ] **Step 1: Create schedule server actions** — upsertSchedule, createBreak, deleteBreak, createOverride, deleteOverride
- [ ] **Step 2: Create schedule table** — rows=days, columns=barbers, editable start/end times
- [ ] **Step 3: Create break manager** — add/remove breaks per day/barber
- [ ] **Step 4: Create override manager** — add overrides (date, available/unavailable, custom hours, reason)
- [ ] **Step 5: Commit**

## Chunk 6: Admin Panel — Advanced

### Task 20: Reservations List & Detail

**Files:**
- Create: `src/app/(admin)/admin/reservations/page.tsx`
- Create: `src/app/(admin)/admin/reservations/[id]/page.tsx`
- Create: `src/components/admin/reservations-table.tsx`
- Create: `src/components/admin/reservation-detail.tsx`
- Create: `src/components/admin/status-actions.tsx`

- [ ] **Step 1: Create reservations table** — DataTable with TanStack Table, columns: date, time, customer, barber, service, status. Filters: date range, barber, status. Server-side pagination.
- [ ] **Step 2: Create reservation detail page** — full appointment info, status history, action buttons
- [ ] **Step 3: Create status actions** — buttons for each valid transition per current status
- [ ] **Step 4: Commit**

### Task 21: Admin Calendar

**Files:**
- Create: `src/app/(admin)/admin/calendar/page.tsx`
- Create: `src/components/admin/admin-calendar.tsx`
- Create: `src/components/admin/admin-booking-modal.tsx`

- [ ] **Step 1: Create admin calendar page** — FullCalendar with day/week views
- [ ] **Step 2: Create admin booking modal** — simplified booking form for manual creation (pre-filled barber, date, time from slot click)
- [ ] **Step 3: Wire calendar events** — click empty slot opens modal, click event navigates to reservation detail
- [ ] **Step 4: Commit**

### Task 22: Customers Management

**Files:**
- Create: `src/app/(admin)/admin/customers/page.tsx`
- Create: `src/app/(admin)/admin/customers/[id]/page.tsx`
- Create: `src/components/admin/customer-detail.tsx`
- Create: `src/server/actions/customers.ts`
- Create: `src/server/queries/customers.ts`

- [ ] **Step 1: Create customer queries** — getCustomers (paginated, searchable), getCustomerById (with appointments)
- [ ] **Step 2: Create customer actions** — createCustomer, updateCustomerNotes
- [ ] **Step 3: Create customers list page** — search, pagination, click to detail
- [ ] **Step 4: Create customer detail page** — contact info, visit count, booking history, editable notes
- [ ] **Step 5: Commit**

## Chunk 7: Finalization

### Task 23: Reminder Cron Job

**Files:**
- Create: `src/app/api/cron/reminders/route.ts`

- [ ] **Step 1: Create cron endpoint** — GET handler, validates CRON_SECRET via Authorization header, finds CONFIRMED appointments 23-25h away with null reminderSentAt, sends reminder emails, updates reminderSentAt
- [ ] **Step 2: Commit**

### Task 24: Polish & Error States

- [ ] **Step 1: Add loading states** to booking wizard steps (Suspense boundaries, skeleton loaders)
- [ ] **Step 2: Add error boundaries** to key pages
- [ ] **Step 3: Verify mobile responsiveness** of booking widget
- [ ] **Step 4: Add SEO meta tags** to booking pages (title, description)
- [ ] **Step 5: Final commit**
