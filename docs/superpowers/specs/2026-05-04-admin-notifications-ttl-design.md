# Admin Notifications Dashboard + Firestore TTL Migration — Design

**Date:** 2026-05-04
**Branch:** `feat/staging`
**Status:** Approved (pending spec review)

## Goals

1. **Per-reservation delivery visibility** — admin can see for each booking whether the confirmation email, cancellation email, reminder (email + SMS), and Telegram admin alert went out, failed, or never applied. Resend button for failed sends.
2. **Aggregate notification health** — at-a-glance dashboard with last-7-day totals, unreachable customers, stuck-pending bookings, rate-limit headroom.
3. **Chronological audit log** — last 100 notification events across all bookings, for debugging customer complaints ("I never got an email").
4. **Replace manual cleanup cron with Firestore native TTL** — eliminate the GitHub Actions cron that currently handles status-history pruning, rate-limit-counter cleanup, and global-booking-counter trimming.

## Non-goals

- Persistent retry queue with exponential backoff for failed notifications (rejected — too much infra for the operational scale; manual Resend button covers it).
- Per-event push notifications to admin (e.g., Telegram alert when an email fails) — the current Telegram alert path will itself record into the log, but no new alerts are introduced.
- Backfill of `confirmationEmailSentAt` for existing pre-feature bookings — those will display "Neznáme" / "—" in the dashboard. Acceptable: the dashboard's purpose is forward-looking debugging.
- SMS confirmation at booking creation (not currently sent; out of scope).

## Architecture

### Three data layers

1. **`AppointmentDoc` fields** (per-booking, source of truth for booking detail page)
2. **`notificationLog/{id}` collection** (chronological audit, queryable, 90-day TTL)
3. **Aggregate counters** — computed on-demand (no separate storage)

### Three UI surfaces

1. **`/admin/notifications`** — dashboard (health widgets, problems table, audit log)
2. **`/admin/reservations/[id]`** — new "Notifikácie" panel with per-deliverable status + Resend buttons
3. **Sidebar** — new "Notifikácie" nav entry

## Data model

### New fields on `AppointmentDoc`

```ts
// Confirmation email — written by createBooking and createAppointmentAdmin
confirmationEmailSentAt: Timestamp | null;
confirmationEmailError: string | null;
confirmationEmailAttempts: number;        // increments on each (re)send

// Cancellation email — written by cancelBooking and admin status→CANCELLED transition
cancellationEmailSentAt: Timestamp | null;
cancellationEmailError: string | null;
cancellationEmailAttempts: number;

// Telegram admin alert — written on booking creation and admin status changes
telegramAlertSentAt: Timestamp | null;
telegramAlertError: string | null;

// Reminder fields ALREADY EXIST and are not changed:
//   reminderEmailSentAt, reminderEmailLockedAt
//   reminderSmsSentAt,   reminderSmsLockedAt
//   reminderSentAt (legacy compat field)
```

Initial values on appointment creation: all sentAt/error are `null`, attempts = `0`.

### New collection `notificationLog`

```ts
type NotificationLogDoc = {
  id: string;
  timestamp: Timestamp;
  kind:
    | "email-confirmation"
    | "email-cancellation"
    | "email-reminder"
    | "sms-reminder"
    | "telegram-alert";
  status: "sent" | "failed";
  appointmentId: string | null;   // null for non-booking events (none today, future-proof)
  recipient: string | null;       // email address or E.164 phone, plain text
  error: string | null;           // error message if status=failed
  durationMs: number | null;      // wall time of the send call
  trigger: "auto" | "manual" | "cron"; // who/what initiated
  expireAt: Timestamp;            // = timestamp + 90 days, watched by Firestore TTL
};
```

Firestore Security Rules: `match /notificationLog/{doc} { allow read, write: if isAdmin(); }`

PII consideration: `recipient` stores the email/phone in plaintext. Admin-only access is enforced via security rules. The same data already lives on `AppointmentDoc.customerEmail/customerPhone`, so this is not a new exposure surface — the log is just a chronological view of events the admin already has the data for.

## Centralized logger

```ts
// src/server/lib/notification-log.ts

export type NotificationKind =
  | "email-confirmation"
  | "email-cancellation"
  | "email-reminder"
  | "sms-reminder"
  | "telegram-alert";

export async function recordNotification(opts: {
  kind: NotificationKind;
  status: "sent" | "failed";
  appointmentId: string | null;
  recipient: string | null;
  error?: string | null;
  durationMs?: number;
  trigger?: "auto" | "manual" | "cron";
}): Promise<void>;
```

The helper:
1. Writes a `notificationLog` doc with `expireAt = now + 90 days`. `trigger` defaults to `"auto"` if not supplied by the caller.
2. If `appointmentId` is non-null, **also** updates the appropriate AppointmentDoc fields (idempotent — `tx.update` is safe to call without re-reading).

The two writes are NOT in the same transaction. Notifications already happen post-commit (we don't roll back a booking because Telegram is down), so a partial write is acceptable: log goes through but appointment field doesn't, or vice versa. Worst case = audit log entry without per-booking field, which is exactly what we'd want anyway (the truth is on the log).

### Wiring map

| Site | Kind | Trigger |
|---|---|---|
| `booking.ts` `createBooking` post-`sendEmail` | email-confirmation | auto |
| `booking.ts` `createBooking` post-`sendTelegramNotification` | telegram-alert | auto |
| `booking.ts` `cancelBooking` post-`sendEmail` | email-cancellation | auto |
| `booking.ts` `cancelBooking` post-`sendTelegramNotification` | telegram-alert | auto |
| `appointments.ts` `createAppointmentAdmin` post-`sendEmail` | email-confirmation | auto |
| `appointments.ts` `updateAppointmentStatus` post-`sendEmail` (cancel path) | email-cancellation | auto |
| `appointments.ts` `updateAppointmentStatus` post-`sendTelegramNotification` | telegram-alert | auto |
| `cron/reminders/route.ts` `processEmail` | email-reminder | cron |
| `cron/reminders/route.ts` `processSms` | sms-reminder | cron |
| New action `resendConfirmationEmail` | email-confirmation | manual |
| New action `resendCancellationEmail` | email-cancellation | manual |
| New action `runRemindersNow` (delegates to existing route) | email-reminder/sms-reminder | manual |

All sites already have `try/catch` or `.catch(...)` — wiring is additive, not invasive.

## TTL migration (cleanup cron replacement)

### Collections with TTL

| Collection / Group | TTL field | Retention | Field-set policy |
|---|---|---|---|
| `notificationLog` | `expireAt` | 90 days | At create: `timestamp + 90d` |
| `history` (collectionGroup, under `appointments/*/history`) | `expireAt` | 365 days | At create: `changedAt + 365d` |
| `counters/phone_*`, `counters/email_*` | `expireAt` | 24h after last booking | On every counter update: `latest_booking_ts + 24h` |
| `counters/global_bookings` | — | — (no TTL) | Field intentionally absent so TTL skips it |

Firestore TTL semantics:
- Only acts on docs that have the configured field populated. Other docs in the same collection are unaffected.
- Deletion happens within ~24 hours after `expireAt` passes; not exact.
- TTL deletes are free (don't count against the daily delete quota).
- Configuration is per-project, one-time setup via `gcloud firestore fields ttls update` or Firebase Console.

### Setup commands (added to CLAUDE.md)

```bash
# notificationLog
gcloud firestore fields ttls update expireAt \
  --collection-group=notificationLog --enable-ttl \
  --project=strojcek-staging
gcloud firestore fields ttls update expireAt \
  --collection-group=notificationLog --enable-ttl \
  --project=strojcek-production

# appointments status history (collection group)
gcloud firestore fields ttls update expireAt \
  --collection-group=history --enable-ttl \
  --project=strojcek-staging
gcloud firestore fields ttls update expireAt \
  --collection-group=history --enable-ttl \
  --project=strojcek-production

# rate-limit counters (only docs that have expireAt; global_bookings doesn't)
gcloud firestore fields ttls update expireAt \
  --collection-group=counters --enable-ttl \
  --project=strojcek-staging
gcloud firestore fields ttls update expireAt \
  --collection-group=counters --enable-ttl \
  --project=strojcek-production
```

### `counters/global_bookings.hourly` — cannot use TTL

This is a field-level trim on a single doc, not a doc deletion. Two-pronged handling:

1. **Inline GC at write time** (already exists, line ~434 in `booking.ts`) — every successful booking trims keys older than 24h before saving. Covers normal operation.
2. **Add GC pass to reminder cron** — once per day, the daily reminder cron loads the doc, trims stale keys, writes back if anything changed. Covers idle days where no booking happens.

The reminder cron is already running daily and is idempotent w.r.t. the trim (it's a no-op when there's nothing stale).

### Files removed

- `src/app/api/cron/cleanup/route.ts` — entire file deleted.
- `.github/workflows/cron.yml` — `cleanup` job entry removed (manually-triggered `workflow_dispatch` job).
- `CLAUDE.md` — references to `/api/cron/cleanup` and the manual cleanup script invocation.

## UI design

### `/admin/notifications` page

Top-level layout:

```
┌──────────────────────────────────────────────────────────┐
│  Notifikácie                          [Spustiť reminder] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Health (posledných 7 dní)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Email    │ │ SMS      │ │ Telegram │ │ Failed   │     │
│  │ 142 ✓    │ │  87 ✓    │ │  85 ✓    │ │   3 ✗    │     │
│  │   3 ✗    │ │   1 ✗    │ │   2 ✗    │ │  → list  │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                          │
│  Problémy                                                │
│  • Customers bez emailu/telefónu (5)                     │
│  • Pending > 24h (2)                                     │
│  • Rate-limit hour headroom: 27/30                       │
│                                                          │
│  Audit log (posledných 100)                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 2026-05-04 14:23 │ email→a@b.sk     │ ✓ SENT       │  │
│  │ 2026-05-04 14:22 │ telegram         │ ✗ FAILED     │  │
│  │ ...                                                │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- "Spustiť reminder" button → server action that calls existing reminder logic with admin session (not CRON_SECRET).
- Health card click → drilldown to filtered audit log.
- Problems list → links to filtered customers / reservations.
- Audit log row click → linked appointment detail (if `appointmentId != null`).

### `/admin/reservations/[id]` panel

Inserted as a new `Card` in the right column (after the existing "Stav" + "História stavov" cards):

```
┌─────────────────────────────────────────┐
│  Notifikácie                            │
├─────────────────────────────────────────┤
│  ✉ Confirmation email                   │
│    Poslaný 2026-05-04 14:23 na a@b.sk   │
│    [Resend]                             │
│                                         │
│  ✉ Cancellation email                   │
│    — (rezervácia nezrušená)             │
│                                         │
│  📱 Reminder (email + SMS)              │
│    Email: čaká (zajtrajšia rezervácia)  │
│    SMS:   poslané 2026-05-04 16:00      │
│                                         │
│  📨 Telegram admin alert                │
│    Poslaný 2026-05-04 14:23             │
└─────────────────────────────────────────┘
```

- Each row shows: icon, label, status (sent/failed/pending/N/A), timestamp, recipient.
- Resend button visibility (per row):
  - **Confirmation email**: visible if `customerEmail != null` AND status is not CANCELLED. Resend always allowed regardless of prior state.
  - **Cancellation email**: visible only if `status == "CANCELLED"` AND `customerEmail != null`.
  - **Reminder (email + SMS)**: NOT individually resendable. Reminder pipeline is cron-driven; admin uses dashboard "Spustiť reminder teraz" instead.
  - **Telegram alert**: not resendable per-row (admin alerts are operational, not customer-facing — re-trigger by re-doing the source action).
- Failed rows display the error message inline; long errors truncated with `title` attribute holding full text on hover.
- No resend rate-limit (single-admin app, low risk of accidental spam). Each Resend increments `*Attempts` and writes a fresh log entry.

### Sidebar

New entry between "Rezervácie" and "Zákazníci":

```
- Dashboard
- Kalendár
- Rezervácie
- Notifikácie  ← NEW
- Zákazníci
- Barberi
- Služby
- Rozvrh
```

Icon: `BellIcon` from lucide-react.

## Server actions

```ts
// src/server/actions/notifications.ts (new file)

/** Re-send the confirmation email for a booking. Loads current
 *  AppointmentDoc, re-renders bookingConfirmationHtml, sends, logs. */
export async function resendConfirmationEmail(
  appointmentId: string
): Promise<{ success: boolean; error?: string }>;

/** Same shape, for cancellation email. Only valid when status=CANCELLED. */
export async function resendCancellationEmail(
  appointmentId: string
): Promise<{ success: boolean; error?: string }>;

/** Triggers the reminder logic for tomorrow's pending reminders.
 *  Reuses the same processEmail/processSms helpers from cron/reminders.
 *  Trigger="manual" in the log. */
export async function runRemindersNow(): Promise<{
  success: boolean;
  emailSent: number;
  smsSent: number;
  emailFailed: number;
  smsFailed: number;
}>;
```

All three call `getSession()` first; reject with `UNAUTH` if no admin claim.

## Server queries

```ts
// src/server/queries/notifications.ts (new file)

export async function getNotificationLog(opts: {
  limit?: number;
  kind?: NotificationKind;
  status?: "sent" | "failed";
  sinceMs?: number;
}): Promise<NotificationLogView[]>;

export async function getNotificationStats(opts: {
  sinceMs: number;  // e.g., 7 days ago
}): Promise<{
  emailSent: number;   emailFailed: number;
  smsSent: number;     smsFailed: number;
  telegramSent: number; telegramFailed: number;
}>;

export async function getProblemsSnapshot(): Promise<{
  customersWithoutEmail: number;
  customersWithoutPhone: number;
  pendingOver24h: number;
  globalBookingsCurrentHour: number;
  globalBookingsCurrentHourLimit: number;
}>;

/** Per-booking delivery status, for the detail page panel. */
export async function getAppointmentNotificationStatus(
  appointmentId: string
): Promise<AppointmentNotificationStatusView>;
```

## Indexes

`notificationLog` queries:
- `where(timestamp)` orderBy(`timestamp desc`) — single-field, automatic.
- `where(kind == X)` orderBy(`timestamp desc`) — composite needed.
- `where(status == "failed")` orderBy(`timestamp desc`) — composite needed.
- `where(appointmentId == X)` orderBy(`timestamp desc`) — composite needed.

Add to `firestore.indexes.json`:

```json
{
  "collectionGroup": "notificationLog",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "kind", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "notificationLog",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "notificationLog",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "appointmentId", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```

## Error handling

- `recordNotification` failures (e.g., Firestore write fails) are caught and logged via `console.error`; they do NOT propagate. The original send-path's success/failure is preserved.
- Resend actions return `{ success: false, error: "…" }` on failure; UI shows toast.
- TTL setup is one-time manual; if forgotten, docs simply accumulate (degraded but functional). Documented in CLAUDE.md.

## Security

- All new queries / actions check `getSession()` for admin claim.
- `notificationLog` security rules: `allow read, write: if isAdmin();`.
- The reminder route at `/api/cron/reminders` keeps `verifyCronAuth` for GitHub Actions; the new "manual run" admin action calls the same internal logic but bypasses the auth check (since it's already authed via session).

## Migration / rollout

1. Code lands on `feat/staging`, deploys to staging-firebase project.
2. Run TTL setup gcloud commands on `strojcek-staging`.
3. Deploy composite indexes for `notificationLog`.
4. Manually trigger old `/api/cron/cleanup` once more (drain pre-TTL backlog), then delete the route.
5. Verify on staging: create a booking, confirm log entry, force a fail (bad SMTP creds), Resend, check.
6. Merge to `main`, deploy to production.
7. Repeat TTL setup + index deploy for `strojcek-production`.

## Out-of-scope (deferred)

- Backfill `confirmationEmailSentAt` for old bookings (treat as "Neznáme").
- Aggregate stats with longer windows (24h / 30d toggles) — start with fixed 7d.
- Email/SMS notification preferences per-customer (currently all-or-nothing).
- Notification log for cleanup events (cleanup is gone post-TTL).

## Testing strategy

- **Manual** for dashboard + Resend buttons (UI verification on staging).
- **Script-based assertion** of TTL behavior — spot-check `expireAt` field is set on writes (extend `scripts/test-firebase-connection.ts` or add `scripts/verify-notification-log.ts`).
- No new vitest setup (project doesn't have one; not introducing for one feature).
