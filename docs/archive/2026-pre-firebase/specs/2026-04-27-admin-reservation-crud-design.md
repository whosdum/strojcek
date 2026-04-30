# Admin reservation CRUD — design

Date: 2026-04-27

## Goal

Allow the admin to manually create new reservations and edit existing ones from the admin panel. Status changes and deletion already exist; this fills the create + edit gaps so the admin can fully manage appointments without going through the customer-facing booking flow.

Primary device: phone. UI must be mobile-first.

## Decisions

1. **Hybrid create.** The admin form mirrors the customer booking flow (service → barber → date → time picked from available slots), but with a toggle "Ignorovať rozvrh / prekryv" that bypasses schedule and overlap checks for walk-ins or special cases.
2. **Edit allowed depending on status.**
   - `PENDING` / `CONFIRMED`: full edit (time, barber, service, customer info, notes, `priceFinal`).
   - `IN_PROGRESS` / `COMPLETED`: only `notes` and `priceFinal` are editable.
   - `CANCELLED` / `NO_SHOW`: edit blocked. The edit page redirects to the detail. To "fix" one of these, the admin deletes and creates a new one.
3. **Separate pages, not modals.** `/admin/reservations/new` and `/admin/reservations/[id]/edit`. Modals are unusable on phone with 6+ fields and a soft keyboard.
4. **Customer entry is always a plain form.** Admin types first name, last name, phone (prefix select +421/+420 + 9-digit input), email (required for create, optional for edit), notes. Backend `upsert`s the `Customer` record by normalized phone — same logic as `createBooking`. No autocomplete or "pick existing customer" UI in v1.
5. **Confirmation email + reminder are sent** to admin-created appointments — same flow as the public booking. A `cancellationToken` is generated so the customer can cancel via the email link. `source: "admin"`, status starts at `CONFIRMED`. The reminder cron is source-agnostic (filters only by status + date), so it picks up admin-created appointments automatically. Telegram notifications to the admin are skipped (admin is the one creating the booking). No SMS confirmation.

## Backend

### `src/lib/validators.ts`

Add two schemas:

```ts
export const adminAppointmentInputSchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: timeString,
  firstName: z.string().min(1),
  lastName: z.string().optional().default(""),
  phone: z.string().regex(/^\+4(20|21)\d{9}$/),
  email: z.string().min(1, "Email je povinný").email("Zadajte platný email"),
  notes: z.string().optional().default(""),
  ignoreSchedule: z.boolean().default(false),
});

export const adminAppointmentEditSchema = adminAppointmentInputSchema.extend({
  // Email may be empty for legacy reservations that pre-date the required-email rule.
  email: z.string().email().optional().or(z.literal("")),
  priceFinal: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
});
```

The "limited edit" rule (only `notes` + `priceFinal` for IN_PROGRESS/COMPLETED) is enforced in the server action, not the schema — the schema accepts the full object and the action ignores irrelevant fields based on current status.

### `src/server/actions/appointments.ts`

Add two actions alongside existing `updateAppointmentStatus` and `deleteAppointment`.

**`createAppointmentAdmin(input)`**
- Validates with `adminAppointmentInputSchema`.
- Looks up `BarberService` to derive duration and price (custom > service default). Returns `BARBER_SERVICE_NOT_OFFERED` error if missing.
- Computes `startTime` / `endTime` in `Europe/Bratislava` (same as `createBooking`).
- `upsert`s `Customer` by normalized phone.
- Generates a `cancellationToken` (raw token sent in email, hashed token stored).
- Inside a transaction:
  - If `!ignoreSchedule` → overlap check (same query as `createBooking`).
  - Insert appointment with `source: "admin"`, `status: "CONFIRMED"`, hashed `cancellationToken`.
  - Insert `AppointmentStatusHistory` row (oldStatus null → CONFIRMED, changedBy "admin").
- After transaction: send confirmation email via `sendEmail()` with `bookingConfirmationHtml` (cancel link + ICS attachment). Email send is fire-and-forget with `.catch()` so a mailer failure doesn't fail the action.
- `revalidatePath("/admin/reservations")`, `/admin/calendar`, `/admin`.

**`updateAppointment(id, input)`**
- Loads the appointment.
- If status is `CANCELLED` or `NO_SHOW` → returns error, edit not allowed.
- Validates with `adminAppointmentEditSchema`.
- If status is `IN_PROGRESS` or `COMPLETED`:
  - Only updates `notes` and `priceFinal`. All other fields are ignored.
- Else (PENDING / CONFIRMED):
  - If service or barber or date/time changed:
    - Re-derive duration/price from `BarberService`.
    - Recompute `endTime` from new `startTime + duration`.
    - If `!ignoreSchedule` → overlap check (excluding the current appointment by id).
  - Update customer record by normalized phone (`upsert`).
  - Update appointment row.
- `revalidatePath` for detail, list, calendar.

Both actions return `{ success, error?, appointmentId? }` matching the existing pattern.

## Frontend

### Pages

**`src/app/(admin)/admin/reservations/new/page.tsx`** — server component.
- Fetches active services + active barbers + barber-service mappings.
- Renders `<AppointmentForm mode="create" services={...} barbers={...} barberServices={...} />`.

**`src/app/(admin)/admin/reservations/[id]/edit/page.tsx`** — server component.
- Loads appointment by id.
- If status is CANCELLED/NO_SHOW → redirect to detail page.
- Otherwise renders `<AppointmentForm mode="edit" appointment={...} services={...} barbers={...} ... />`.

### `src/components/admin/appointment-form.tsx` (new, client component)

Single form used for both create and edit. Sections, top to bottom (mobile-first single column):

1. **Služba a barber.** Two `Select`s. When the user changes service or barber, the form re-fetches available slots for the current date.
2. **Dátum.** `<input type="date">` with `min` = today (unless `ignoreSchedule`).
3. **Čas.**
   - Default: dropdown with available slots fetched via `fetchSlots(barberId, serviceId, date)`. Shows "Žiadne voľné termíny" if empty.
   - When `ignoreSchedule` is on: switches to plain `<input type="time">` so the admin can type any time.
4. **Toggle "Ignorovať rozvrh / prekryv".** Below the time field with a short helper line ("Použi pre walk-in alebo neštandardný termín.").
5. **Zákazník.** First name, last name, phone, email. Phone is the identifier — backend matches/creates by it.
6. **Poznámka.** Textarea.
7. **Cena (`priceFinal`)** — only shown in edit mode. Empty = unset (admin hasn't recorded final price yet).
8. Submit + back button. In edit mode for IN_PROGRESS/COMPLETED, fields 1–6 are disabled and only notes + priceFinal are editable; a banner explains why ("Termín už prebieha alebo je dokončený. Možno upraviť len cenu a poznámku.").

State:
- `react-hook-form` + `zodResolver` (matches existing forms).
- Slot list: local state, fetched via the existing `fetchSlots` server action whenever `barberId`, `serviceId`, or `date` changes (debounced).
- On submit: call `createAppointmentAdmin` or `updateAppointment`, toast result, navigate.

### Buttons

**`/admin/reservations/page.tsx`** — add a "+ Nová rezervácia" button next to the H1, linking to `/admin/reservations/new`. Mobile: full width below H1.

**`/admin/reservations/[id]/page.tsx`** — add an "Upraviť" button next to the existing "Zmazať". Hidden when status is CANCELLED or NO_SHOW.

## Validation and edge cases

- Past dates: blocked unless `ignoreSchedule` is on.
- Overlap with existing appointment: blocked unless `ignoreSchedule` is on. In edit mode the current appointment is excluded from the overlap query.
- Editing the only customer field that's also a Customer key (phone): backend upserts. If admin types a different existing customer's phone, the appointment will be reassigned to that customer record. This is acceptable — the admin is explicitly swapping the customer.
- Editing CANCELLED/NO_SHOW: 403 from server, redirect from page.
- Service/barber pair without `BarberService` row: action returns "Barber neponúka túto službu." Form blocks submit if pair is invalid.

## Out of scope

- Calendar drag-to-create (could come later).
- Customer search/autocomplete (we always type or paste; reuse from `/admin/customers` later if needed).
- Sending notifications on **edit** (only create sends a confirmation email).
- Bulk operations.
