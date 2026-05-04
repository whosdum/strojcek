# Admin Notifications Dashboard + Firestore TTL Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-facing notifications dashboard (per-booking delivery status, aggregate health widgets, audit log, manual resend) and replace the manually-triggered cleanup cron with native Firestore TTL across four collections.

**Architecture:** Centralized `recordNotification()` helper called from every existing send-path writes both a chronological `notificationLog` doc and per-booking AppointmentDoc fields. Firestore TTL on `notificationLog` (90d), `history` collection group (365d), and rate-limit counters (24h) replaces the cleanup cron entirely. UI surfaces: new `/admin/notifications` page, panel in `/admin/reservations/[id]`, sidebar entry.

**Tech Stack:** Next.js 16, Firestore (Admin SDK server-side), React 19, Tailwind 4, lucide-react icons, sonner toasts.

**Spec:** [docs/superpowers/specs/2026-05-04-admin-notifications-ttl-design.md](../specs/2026-05-04-admin-notifications-ttl-design.md)

**Branch:** `feat/staging`

**Testing strategy:** This codebase has no test framework (no vitest/jest). Verification per task uses (a) `npx tsc --noEmit` for typechecking, (b) `npm run lint`, (c) targeted `tsx` scripts when behavior matters, (d) manual smoke testing on `npm run dev:emulators` + `npm run dev:app` for UI tasks.

---

## File Structure

**Create:**
- `src/server/lib/notification-log.ts` — `recordNotification()` helper, types
- `src/server/queries/notifications.ts` — dashboard queries (log list, stats, problems snapshot, per-appointment status)
- `src/server/actions/notifications.ts` — `resendConfirmationEmail`, `resendCancellationEmail`, `runRemindersNow`
- `src/components/admin/notification-status-panel.tsx` — per-reservation panel (renders 4 deliverable rows)
- `src/components/admin/resend-button.tsx` — small client component that wraps a server action call + toast
- `src/components/admin/run-reminders-button.tsx` — manual reminder run trigger
- `src/app/(admin)/admin/notifications/page.tsx` — dashboard
- `scripts/verify-notification-log.ts` — TTL field write spot-check

**Modify:**
- `src/server/types/firestore.ts` — `AppointmentDoc` + `NotificationLogDoc`
- `src/lib/types.ts` — view types for the dashboard / panel
- `src/server/actions/booking.ts` — wire createBooking + cancelBooking
- `src/server/actions/appointments.ts` — wire createAppointmentAdmin + updateAppointmentStatus
- `src/app/api/cron/reminders/route.ts` — log + hourly GC pass
- `src/app/(admin)/admin/reservations/[id]/page.tsx` — render panel
- `src/components/admin/sidebar.tsx` — new nav entry
- `firestore.indexes.json` — composite indexes for `notificationLog` + remove `history.changedAt` index (no longer needed)
- `firestore.rules` — `notificationLog` admin-only rule
- `CLAUDE.md` — TTL setup instructions, drop cleanup cron mentions
- `.github/workflows/cron.yml` — drop `cleanup` job

**Delete:**
- `src/app/api/cron/cleanup/route.ts`

---

## Phase A — Foundation

### Task A1: Add `NotificationLogDoc` and AppointmentDoc fields to firestore types

**Files:**
- Modify: `src/server/types/firestore.ts`

- [ ] **Step 1: Read the existing AppointmentDoc shape**

Run: `grep -n "AppointmentDoc\|export type" src/server/types/firestore.ts`

Familiarize yourself with the surrounding code so the new fields slot into the same conventions (camelCase, `Timestamp | null` for nullable instants, no comments above field unless non-obvious).

- [ ] **Step 2: Append delivery-status fields to `AppointmentDoc`**

Edit `src/server/types/firestore.ts`. Find the `AppointmentDoc` type (it currently ends with `reminderSentAt` legacy + `reminder*SentAt`/`reminder*LockedAt` per-channel fields, plus `createdAt`/`updatedAt`). Add these fields just before `createdAt`:

```ts
  // Delivery status — written by recordNotification post-send.
  // null = no attempt logged yet. Reset to null + set sentAt on success.
  confirmationEmailSentAt: Timestamp | null;
  confirmationEmailError: string | null;
  confirmationEmailAttempts: number;

  cancellationEmailSentAt: Timestamp | null;
  cancellationEmailError: string | null;
  cancellationEmailAttempts: number;

  telegramAlertSentAt: Timestamp | null;
  telegramAlertError: string | null;
```

- [ ] **Step 3: Add `NotificationLogDoc` type**

At the bottom of `src/server/types/firestore.ts` (after `GlobalBookingsCounterDoc`), add:

```ts
export type NotificationKind =
  | "email-confirmation"
  | "email-cancellation"
  | "email-reminder"
  | "sms-reminder"
  | "telegram-alert";

export type NotificationStatus = "sent" | "failed";

export type NotificationTrigger = "auto" | "manual" | "cron";

export type NotificationLogDoc = {
  id: string;
  timestamp: Timestamp;
  kind: NotificationKind;
  status: NotificationStatus;
  appointmentId: string | null;
  recipient: string | null;
  error: string | null;
  durationMs: number | null;
  trigger: NotificationTrigger;
  /** Watched by the Firestore TTL policy on this collection. */
  expireAt: Timestamp;
};
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (If existing code reads `AppointmentDoc` and creates it without the new fields, TS will flag missing properties — we'll fix those in subsequent tasks. If the project's tsconfig has `strict: true` and you see "missing property" errors against AppointmentDoc, note them but DO NOT fix in this task; they'll be addressed when we wire each call site.)

If you see "missing property" errors, jump to Step 5 anyway — we'll resolve them in Phase B/C tasks.

- [ ] **Step 5: Commit**

```bash
git add src/server/types/firestore.ts
git commit -m "feat(types): add notification delivery fields to AppointmentDoc + NotificationLogDoc"
```

---

### Task A2: Implement `recordNotification` helper

**Files:**
- Create: `src/server/lib/notification-log.ts`

- [ ] **Step 1: Read existing `firestore-utils.ts` for conventions**

Run: `cat src/server/lib/firestore-utils.ts`

Note imports, "server-only" pattern, and any helper exports.

- [ ] **Step 2: Create the helper file**

Write `src/server/lib/notification-log.ts`:

```ts
import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type {
  NotificationKind,
  NotificationStatus,
  NotificationTrigger,
} from "@/server/types/firestore";

const RETENTION_DAYS = 90;

interface RecordOptions {
  kind: NotificationKind;
  status: NotificationStatus;
  appointmentId: string | null;
  recipient: string | null;
  error?: string | null;
  durationMs?: number;
  trigger?: NotificationTrigger;
}

/**
 * Per-AppointmentDoc field group for each kind. The reminder kinds are
 * intentionally absent — they're tracked via the existing
 * `reminderEmailSentAt` / `reminderSmsSentAt` fields and the cron's
 * lock-then-send protocol; this helper only writes the audit log entry
 * for them.
 */
const APPOINTMENT_FIELD_MAP: Partial<
  Record<
    NotificationKind,
    { sentAt: string; error: string; attempts: string }
  >
> = {
  "email-confirmation": {
    sentAt: "confirmationEmailSentAt",
    error: "confirmationEmailError",
    attempts: "confirmationEmailAttempts",
  },
  "email-cancellation": {
    sentAt: "cancellationEmailSentAt",
    error: "cancellationEmailError",
    attempts: "cancellationEmailAttempts",
  },
  "telegram-alert": {
    sentAt: "telegramAlertSentAt",
    error: "telegramAlertError",
    // Telegram has no attempts counter — there's no Resend button for it.
    attempts: "",
  },
};

/**
 * Records a notification event to the audit log AND updates per-booking
 * fields on the AppointmentDoc (when applicable). Both writes are
 * best-effort and isolated — a failure of either is logged via console
 * and swallowed; the original send path's success/failure is unaffected.
 */
export async function recordNotification(opts: RecordOptions): Promise<void> {
  const trigger = opts.trigger ?? "auto";
  const now = Timestamp.now();
  const expireAt = Timestamp.fromMillis(
    now.toMillis() + RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  // Audit log write — independent of the appointment write below.
  try {
    const ref = adminDb.collection("notificationLog").doc();
    await ref.set({
      id: ref.id,
      timestamp: now,
      kind: opts.kind,
      status: opts.status,
      appointmentId: opts.appointmentId,
      recipient: opts.recipient,
      error: opts.error ?? null,
      durationMs: opts.durationMs ?? null,
      trigger,
      expireAt,
    });
  } catch (err) {
    console.error("[notification-log] audit write failed:", err);
  }

  // Per-AppointmentDoc field update — only for kinds with a field group.
  if (!opts.appointmentId) return;
  const fields = APPOINTMENT_FIELD_MAP[opts.kind];
  if (!fields) return;

  try {
    const update: Record<string, unknown> = {};
    if (opts.status === "sent") {
      update[fields.sentAt] = now;
      update[fields.error] = null;
    } else {
      update[fields.error] = opts.error ?? "unknown";
    }
    if (fields.attempts) {
      update[fields.attempts] = FieldValue.increment(1);
    }
    await adminDb.doc(`appointments/${opts.appointmentId}`).update(update);
  } catch (err) {
    console.error(
      `[notification-log] appointment field update failed for ${opts.appointmentId}:`,
      err
    );
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/lib/notification-log.ts
git commit -m "feat(notification-log): add recordNotification helper"
```

---

### Task A3: Add `notificationLog` security rule

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the rule**

Edit `firestore.rules`. Locate the section after `match /counters/{any=**}` and before `match /users/{uid}`. Insert:

```
    match /notificationLog/{doc} {
      allow read, write: if isAdmin();
    }
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): admin-only access to notificationLog"
```

> **NOTE:** Don't deploy yet — we'll deploy rules + indexes together at the end of Phase A.

---

### Task A4: Add composite indexes for `notificationLog` queries + drop unused `history.changedAt`

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Drop the obsolete `history.changedAt` index**

The cleanup cron used this index for its `where("changedAt", "<", cutoff)` query. Once the cron is deleted (Phase C), the index becomes dead weight. Remove the entry that contains:

```json
{
  "collectionGroup": "history",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "changedAt", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 2: Add three composite indexes for `notificationLog`**

In the `indexes` array of `firestore.indexes.json`, append:

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

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('firestore.indexes.json'))"`
Expected: no output (valid JSON).

- [ ] **Step 4: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat(firestore): notificationLog composite indexes; drop history.changedAt"
```

---

## Phase B — Wire existing send sites to the logger

> Each task in this phase touches one send-path. Read the surrounding context before editing — many of these calls are inside `try/catch` and you must preserve the existing error handling.

### Task B1: Wire `createBooking` confirmation email to logger + initialize new fields

**Files:**
- Modify: `src/server/actions/booking.ts`

- [ ] **Step 1: Open booking.ts and locate the appointment-create transaction**

Run: `grep -n "tx.create(apptRef\|sendEmail\|sendTelegramNotification" src/server/actions/booking.ts`

You should see `tx.create(apptRef, ...)` around line 380, `sendEmail` around line 485, and `sendTelegramNotification` around line 509.

- [ ] **Step 2: Initialize new AppointmentDoc fields on creation**

Find the `tx.create(apptRef, stripUndefined({ ... }))` call inside `createBooking`. The object currently ends with `reminderSentAt: null, createdAt: ..., updatedAt: ...`. Just before `createdAt`, add:

```ts
            confirmationEmailSentAt: null,
            confirmationEmailError: null,
            confirmationEmailAttempts: 0,
            cancellationEmailSentAt: null,
            cancellationEmailError: null,
            cancellationEmailAttempts: 0,
            telegramAlertSentAt: null,
            telegramAlertError: null,
```

- [ ] **Step 3: Import `recordNotification`**

At the top of the file, add to the imports:

```ts
import { recordNotification } from "@/server/lib/notification-log";
```

- [ ] **Step 4: Wire the confirmation email send**

Find the existing `sendEmail({ ... }).catch((err) => { console.error("[booking][email]", err); return { success: false } as const; })` block (around line 485-500). Replace the entire `await sendEmail({...}).catch(...)` expression with a timed wrapper:

```ts
    const emailStart = Date.now();
    const emailResult = await sendEmail({
      to: data.email,
      subject: "Potvrdenie rezervácie - Strojček",
      html: bookingConfirmationHtml({
        customerName: data.firstName,
        serviceName: bs.serviceName,
        barberName,
        date: formattedDate,
        time: formattedTime,
        price: (priceCents / 100).toString(),
        cancelUrl,
        startTimeUtc: startTime.toISOString(),
        endTimeUtc: endTime.toISOString(),
      }),
    }).catch((err) => {
      console.error("[booking][email]", err);
      return { success: false, error: err } as const;
    });
    await recordNotification({
      kind: "email-confirmation",
      status: emailResult.success ? "sent" : "failed",
      appointmentId,
      recipient: data.email,
      error: emailResult.success
        ? null
        : (emailResult as { error?: unknown }).error instanceof Error
          ? ((emailResult as { error: Error }).error.message)
          : emailResult.success === false && (emailResult as { error?: string }).error
            ? String((emailResult as { error: string }).error)
            : null,
      durationMs: Date.now() - emailStart,
    });
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. The complicated error-extraction expression is verbose because `sendEmail` returns a discriminated union; if TS complains about the cast, simplify by changing the catch to always return `{ success: false, error: err instanceof Error ? err.message : String(err) }` and reading `.error` directly.

If TS errors persist, replace the `error:` line with a simpler version:

```ts
      error: emailResult.success ? null : "send failed",
```

- [ ] **Step 6: Commit**

```bash
git add src/server/actions/booking.ts
git commit -m "feat(booking): log createBooking confirmation email + init notification fields"
```

---

### Task B2: Wire `createBooking` Telegram alert to logger

**Files:**
- Modify: `src/server/actions/booking.ts`

- [ ] **Step 1: Locate the Telegram block**

Run: `grep -n "TELEGRAM_CHAT_ID\|sendTelegramNotification" src/server/actions/booking.ts`

There should be a block in `createBooking` (around line 505) starting with `const chatId = process.env.TELEGRAM_CHAT_ID; if (chatId) { sendTelegramNotification({...}).catch(...); }`.

- [ ] **Step 2: Replace fire-and-forget with logged send**

Replace the existing `if (chatId) { sendTelegramNotification({...}).catch(...) }` block with:

```ts
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      const tgStart = Date.now();
      sendTelegramNotification({
        chatId,
        message:
          `<b>Nová rezervácia</b>\n` +
          `Zákazník: ${escapeTelegramHtml(`${data.firstName} ${data.lastName}`)}\n` +
          `Služba: ${escapeTelegramHtml(bs.serviceName)}\n` +
          `Dátum: ${escapeTelegramHtml(formattedDate)} o ${escapeTelegramHtml(formattedTime)}\n` +
          `Tel: ${escapeTelegramHtml(phone)}\n` +
          `Email: ${escapeTelegramHtml(data.email)}`,
      })
        .then(() =>
          recordNotification({
            kind: "telegram-alert",
            status: "sent",
            appointmentId,
            recipient: chatId,
            durationMs: Date.now() - tgStart,
          })
        )
        .catch((err) => {
          console.error("[booking][telegram]", err);
          return recordNotification({
            kind: "telegram-alert",
            status: "failed",
            appointmentId,
            recipient: chatId,
            error: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - tgStart,
          });
        });
    }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/booking.ts
git commit -m "feat(booking): log createBooking Telegram alert"
```

---

### Task B3: Wire `cancelBooking` email + Telegram to logger

**Files:**
- Modify: `src/server/actions/booking.ts`

- [ ] **Step 1: Locate `cancelBooking` send sites**

Run: `grep -n "^export async function cancelBooking\|sendEmail\|sendTelegramNotification" src/server/actions/booking.ts | head -20`

`cancelBooking` is around line 540. Inside it, `sendEmail` is around line 651 and `sendTelegramNotification` around line 682. The function uses a `notifications: Promise<unknown>[] = []` array and pushes each promise.

- [ ] **Step 2: Get the appointmentId in scope**

Inside `cancelBooking`, the variable holding the appointment ID is `appointment.id` (where `appointment` is the loaded doc). Verify with `grep` if uncertain.

- [ ] **Step 3: Replace the cancellation email push**

Find the `if (appointment.customerEmail) { notifications.push(sendEmail({...}).catch(...)) }` block (around line 648-663). Replace with:

```ts
    if (appointment.customerEmail) {
      const emailStart = Date.now();
      notifications.push(
        sendEmail({
          to: appointment.customerEmail,
          subject: "Rezervácia zrušená - Strojček",
          html: bookingCancellationHtml({
            customerName: appointment.customerName || "zákazník",
            serviceName: appointment.serviceName,
            barberName: appointment.barberName,
            date: format(localCancelStart, "d.M.yyyy"),
            time: format(localCancelStart, "HH:mm"),
            bookUrl: PUBLIC_SITE_URL,
          }),
        })
          .then((r) =>
            recordNotification({
              kind: "email-cancellation",
              status: r.success ? "sent" : "failed",
              appointmentId: appointment.id,
              recipient: appointment.customerEmail,
              error: r.success ? null : "send failed",
              durationMs: Date.now() - emailStart,
            })
          )
          .catch((err) => {
            console.error("[EMAIL]", err);
            return recordNotification({
              kind: "email-cancellation",
              status: "failed",
              appointmentId: appointment.id,
              recipient: appointment.customerEmail,
              error: err instanceof Error ? err.message : String(err),
              durationMs: Date.now() - emailStart,
            });
          })
      );
    }
```

- [ ] **Step 4: Replace the Telegram push**

Find the `if (chatId) { ... sendTelegramNotification({...}) ... }` block inside `cancelBooking` (around line 665-690). The existing code constructs a message with cancellation details. Wrap it with logger:

```ts
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      const formattedDate = format(localCancelStart, "d.M.yyyy");
      const formattedTime = format(localCancelStart, "HH:mm");
      const safeCustomerName = escapeTelegramHtml(
        appointment.customerName || "Hosť"
      );
      const tgStart = Date.now();
      notifications.push(
        sendTelegramNotification({
          chatId,
          message:
            `<b>Rezervácia zrušená</b>\n` +
            `Zákazník: ${safeCustomerName}\n` +
            `Služba: ${escapeTelegramHtml(appointment.serviceName)}\n` +
            `Dátum: ${escapeTelegramHtml(formattedDate)} o ${escapeTelegramHtml(formattedTime)}` +
            (data.reason ? `\nDôvod: ${escapeTelegramHtml(data.reason)}` : ""),
        })
          .then(() =>
            recordNotification({
              kind: "telegram-alert",
              status: "sent",
              appointmentId: appointment.id,
              recipient: chatId,
              durationMs: Date.now() - tgStart,
            })
          )
          .catch((err) => {
            console.error("[TELEGRAM]", err);
            return recordNotification({
              kind: "telegram-alert",
              status: "failed",
              appointmentId: appointment.id,
              recipient: chatId,
              error: err instanceof Error ? err.message : String(err),
              durationMs: Date.now() - tgStart,
            });
          })
      );
    }
```

> If the existing message text differs from above (different label / fields), preserve the existing text — only the `.then()`/`.catch()` wrapping is what's new.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/actions/booking.ts
git commit -m "feat(booking): log cancelBooking email + Telegram"
```

---

### Task B4: Wire `createAppointmentAdmin` email + Telegram

**Files:**
- Modify: `src/server/actions/appointments.ts`

- [ ] **Step 1: Locate the admin-create send sites**

Run: `grep -n "^export async function createAppointmentAdmin\|sendEmail\|sendTelegramNotification" src/server/actions/appointments.ts | head -20`

Confirmation email is around line 435; Telegram around line 460. The appointmentId variable is created earlier in the same function (likely `appointmentRef.id` or similar — verify).

- [ ] **Step 2: Import logger + initialize new fields**

Add to the imports at the top:

```ts
import { recordNotification } from "@/server/lib/notification-log";
```

Find the `tx.create(appointmentRef, ...)` call inside `createAppointmentAdmin` and add the same 8 fields just before `createdAt` as in Task B1 Step 2:

```ts
            confirmationEmailSentAt: null,
            confirmationEmailError: null,
            confirmationEmailAttempts: 0,
            cancellationEmailSentAt: null,
            cancellationEmailError: null,
            cancellationEmailAttempts: 0,
            telegramAlertSentAt: null,
            telegramAlertError: null,
```

- [ ] **Step 3: Wire the confirmation email**

Find the `await sendEmail({...})` call inside `if (customerEmail && rawToken) { ... }`. Wrap with logger:

```ts
      if (customerEmail && rawToken) {
        const cancelUrl = `${PUBLIC_SITE_URL}/cancel?token=${rawToken}`;
        const emailStart = Date.now();
        const emailResult = await sendEmail({
          to: customerEmail,
          subject: "Potvrdenie rezervácie - Strojček",
          html: bookingConfirmationHtml({
            customerName: data.firstName || customerName,
            serviceName: bs.serviceName,
            barberName,
            date: formattedDate,
            time: formattedTime,
            price: (priceCents / 100).toString(),
            cancelUrl,
            startTimeUtc: startTime.toISOString(),
            endTimeUtc: endTime.toISOString(),
          }),
        }).catch((err) => {
          console.error("[admin-create][email]", err);
          return { success: false } as const;
        });
        await recordNotification({
          kind: "email-confirmation",
          status: emailResult.success ? "sent" : "failed",
          appointmentId: appointmentRef.id,
          recipient: customerEmail,
          error: emailResult.success ? null : "send failed",
          durationMs: Date.now() - emailStart,
        });
      }
```

> Note: `appointmentRef.id` may be named differently in your file — preserve whatever the surrounding code uses.

- [ ] **Step 4: Wire the admin-create Telegram alert**

Find the `if (chatId) { sendTelegramNotification({...}).catch(...) }` block inside `createAppointmentAdmin` (around line 460). Wrap analogously to Task B2:

```ts
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        const tgStart = Date.now();
        sendTelegramNotification({
          chatId,
          message: /* existing message expression — preserve as-is */,
        })
          .then(() =>
            recordNotification({
              kind: "telegram-alert",
              status: "sent",
              appointmentId: appointmentRef.id,
              recipient: chatId,
              durationMs: Date.now() - tgStart,
            })
          )
          .catch((err) => {
            console.error("[admin-create][telegram]", err);
            return recordNotification({
              kind: "telegram-alert",
              status: "failed",
              appointmentId: appointmentRef.id,
              recipient: chatId,
              error: err instanceof Error ? err.message : String(err),
              durationMs: Date.now() - tgStart,
            });
          });
      }
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/actions/appointments.ts
git commit -m "feat(appointments): log admin createAppointment email + Telegram"
```

---

### Task B5: Wire `updateAppointmentStatus` cancellation email + Telegram

**Files:**
- Modify: `src/server/actions/appointments.ts`

- [ ] **Step 1: Locate the post-tx notification block**

Inside `updateAppointmentStatus`, after the transaction returns `result.kind === "ok"`, the code sends:
- A cancellation email when `newStatus === "CANCELLED"` (around line 220)
- A Telegram alert on every transition (around line 239)

- [ ] **Step 2: Wrap the cancellation email**

```ts
      if (
        newStatus === "CANCELLED" &&
        result.prev.status !== "CANCELLED" &&
        result.prev.customerEmail
      ) {
        const emailStart = Date.now();
        sendEmail({
          to: result.prev.customerEmail,
          subject: "Vaša rezervácia bola zrušená — Strojček",
          html: bookingCancellationHtml({
            customerName: result.prev.customerName || "zákazník",
            serviceName: result.prev.serviceName,
            barberName: result.prev.barberName,
            date: dateStr,
            time: timeStr,
            bookUrl: PUBLIC_SITE_URL,
          }),
        })
          .then((r) =>
            recordNotification({
              kind: "email-cancellation",
              status: r.success ? "sent" : "failed",
              appointmentId: id,
              recipient: result.prev.customerEmail,
              error: r.success ? null : "send failed",
              durationMs: Date.now() - emailStart,
            })
          )
          .catch((err) => {
            console.error("[updateAppointmentStatus][email]", err);
            return recordNotification({
              kind: "email-cancellation",
              status: "failed",
              appointmentId: id,
              recipient: result.prev.customerEmail,
              error: err instanceof Error ? err.message : String(err),
              durationMs: Date.now() - emailStart,
            });
          });
      }
```

- [ ] **Step 3: Wrap the Telegram audit alert**

```ts
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        const tgStart = Date.now();
        sendTelegramNotification({
          chatId,
          message:
            `<b>Stav rezervácie zmenený</b>\n` +
            `${escapeTelegramHtml(result.prev.serviceName)} · ${escapeTelegramHtml(result.prev.barberName)}\n` +
            `${dateStr} ${timeStr}\n` +
            `${result.prev.status} → <b>${newStatus}</b>\n` +
            (result.prev.customerName
              ? `Zákazník: ${escapeTelegramHtml(result.prev.customerName)}`
              : ""),
        })
          .then(() =>
            recordNotification({
              kind: "telegram-alert",
              status: "sent",
              appointmentId: id,
              recipient: chatId,
              durationMs: Date.now() - tgStart,
            })
          )
          .catch((err) => {
            console.error("[updateAppointmentStatus][telegram]", err);
            return recordNotification({
              kind: "telegram-alert",
              status: "failed",
              appointmentId: id,
              recipient: chatId,
              error: err instanceof Error ? err.message : String(err),
              durationMs: Date.now() - tgStart,
            });
          });
      }
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/actions/appointments.ts
git commit -m "feat(appointments): log updateAppointmentStatus email + Telegram"
```

---

### Task B6: Wire reminder cron + add hourly GC pass

**Files:**
- Modify: `src/app/api/cron/reminders/route.ts`

- [ ] **Step 1: Import logger and required deps**

Add to the imports at the top:

```ts
import { recordNotification } from "@/server/lib/notification-log";
import { hourKey } from "@/server/lib/firestore-utils";
import { subHours } from "date-fns";
```

`hourKey` and `subHours` may already be imported if the file references them — check before adding duplicates.

- [ ] **Step 2: Wrap `processEmail` send**

Find the `await sendEmail({...})` inside `processEmail` (around line 125). Replace the existing block (`const result = await sendEmail({...}); if (!result.success) throw ...; await markSent(ref, "email"); counters.emailSent++;`) with:

```ts
  try {
    const localStart = toZonedTime(appt.startTime.toDate(), TIMEZONE);
    const emailStart = Date.now();
    const result = await sendEmail({
      to: appt.customerEmail,
      subject: "Pripomienka rezervácie — Strojček",
      html: bookingReminderHtml({
        customerName: appt.customerName || "zákazník",
        serviceName: appt.serviceName,
        barberName: appt.barberName,
        date: format(localStart, "d.M.yyyy"),
        time: format(localStart, "HH:mm"),
      }),
    });
    if (!result.success) throw result.error ?? new Error("send failed");
    await markSent(ref, "email");
    counters.emailSent++;
    await recordNotification({
      kind: "email-reminder",
      status: "sent",
      appointmentId: ref.id,
      recipient: appt.customerEmail,
      durationMs: Date.now() - emailStart,
      trigger: "cron",
    });
  } catch (err) {
    console.error(`[cron/reminders] email send failed for ${ref.id}:`, err);
    await releaseLock(ref, "email").catch(() => {});
    counters.emailFailed++;
    await recordNotification({
      kind: "email-reminder",
      status: "failed",
      appointmentId: ref.id,
      recipient: appt.customerEmail,
      error: err instanceof Error ? err.message : String(err),
      trigger: "cron",
    });
  }
```

- [ ] **Step 3: Wrap `processSms` send**

Apply the same pattern to `processSms` — wrap the success path with `recordNotification({ kind: "sms-reminder", status: "sent", ... })` and the catch with `status: "failed"`. The phone is `appt.customerPhone`.

- [ ] **Step 4: Add hourly GC pass at the start of the GET handler**

Inside `export async function GET(request: NextRequest) { ... }`, AFTER the auth check and BEFORE the appointments query, insert:

```ts
  // GC pass for counters/global_bookings.hourly. The map is also trimmed
  // inline at every booking write, but a quiet day with no bookings
  // would let stale buckets accumulate. The cleanup cron used to handle
  // this; now we piggy-back on the daily reminder job.
  try {
    const globalRef = adminDb.doc("counters/global_bookings");
    const globalSnap = await globalRef.get();
    if (globalSnap.exists) {
      const hourly = (globalSnap.data() as {
        hourly?: Record<string, number>;
      }).hourly ?? {};
      const cutoffHourKey = hourKey(subHours(new Date(), 24));
      const trimmed: Record<string, number> = {};
      let trimmedCount = 0;
      for (const [k, v] of Object.entries(hourly)) {
        if (k >= cutoffHourKey) trimmed[k] = v;
        else trimmedCount++;
      }
      if (trimmedCount > 0) {
        await globalRef.set({ hourly: trimmed });
      }
    }
  } catch (err) {
    console.error("[cron/reminders] global_bookings hourly GC failed:", err);
  }
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/cron/reminders/route.ts
git commit -m "feat(cron/reminders): log per-channel sends + GC global_bookings hourly map"
```

---

## Phase C — TTL field-set + cleanup cron removal

### Task C1: Set `expireAt` on history doc creation

**Files:**
- Modify: `src/server/actions/booking.ts`
- Modify: `src/server/actions/appointments.ts`

- [ ] **Step 1: Find every `tx.create(historyRef, ...)` call**

Run: `grep -rn "tx.create(historyRef\|historyRef.collection\|history\").doc" src/server`

You should see history docs created in `createBooking`, `updateAppointmentStatus`, and possibly `createAppointmentAdmin`/`updateAppointment`.

- [ ] **Step 2: Add `expireAt` to each history `tx.create` payload**

For each match, add `expireAt: Timestamp.fromMillis(Timestamp.now().toMillis() + 365 * 24 * 60 * 60 * 1000)` to the create payload. Example (`createBooking`):

```ts
        const historyRef = apptRef.collection("history").doc();
        tx.create(historyRef, {
          id: historyRef.id,
          oldStatus: null,
          newStatus: "CONFIRMED",
          changedBy: "system",
          reason: null,
          changedAt: Timestamp.now(),
          expireAt: Timestamp.fromMillis(
            Timestamp.now().toMillis() + 365 * 24 * 60 * 60 * 1000
          ),
        });
```

- [ ] **Step 3: Add `expireAt` to history type**

Edit `src/server/types/firestore.ts`. Find `AppointmentStatusHistoryDoc` and add:

```ts
  /** Watched by Firestore TTL on the `history` collection group. */
  expireAt: Timestamp;
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/actions/booking.ts src/server/actions/appointments.ts src/server/types/firestore.ts
git commit -m "feat(history): set 365d expireAt for Firestore TTL"
```

---

### Task C2: Set `expireAt` on rate-limit counter writes

**Files:**
- Modify: `src/server/actions/booking.ts`

- [ ] **Step 1: Find the counter writes**

Run: `grep -n "phoneCounterRef\|emailCounterRef\|tx.set(.*phoneCounter\|tx.set(.*emailCounter" src/server/actions/booking.ts`

There should be `tx.set(phoneCounterRef, { bookings: [...recentPhone, nowTs] })` and `tx.set(emailCounterRef, { bookings: [...recentEmail, nowTs] })` inside `createBooking`.

- [ ] **Step 2: Add `expireAt` to both counter writes**

```ts
        const counterExpireAt = Timestamp.fromMillis(
          nowTs.toMillis() + 24 * 60 * 60 * 1000
        );
        tx.set(phoneCounterRef, {
          bookings: [...recentPhone, nowTs],
          expireAt: counterExpireAt,
        });
        tx.set(emailCounterRef, {
          bookings: [...recentEmail, nowTs],
          expireAt: counterExpireAt,
        });
```

- [ ] **Step 3: Add `expireAt` to counter type**

Edit `src/server/types/firestore.ts`. Find `PhoneBookingsCounterDoc`. Update:

```ts
export type PhoneBookingsCounterDoc = {
  bookings: Timestamp[];
  /** Watched by TTL on the `counters` collection. Set to
   *  latest_booking_ts + 24h on each write. global_bookings has no
   *  expireAt, so TTL skips it. */
  expireAt: Timestamp;
};
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/actions/booking.ts src/server/types/firestore.ts
git commit -m "feat(counters): 24h expireAt for Firestore TTL on rate-limit counters"
```

---

### Task C3: Delete cleanup cron route + workflow + CLAUDE.md mentions

**Files:**
- Delete: `src/app/api/cron/cleanup/route.ts`
- Modify: `.github/workflows/cron.yml`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Delete the cleanup route**

```bash
git rm src/app/api/cron/cleanup/route.ts
```

- [ ] **Step 2: Drop the `cleanup` job from the workflow**

Edit `.github/workflows/cron.yml`. Remove the entire `cleanup:` job block (lines 34-45 as of writing). Also remove the parenthetical `(also the only way to run cleanup)` from the `workflow_dispatch:` comment — `workflow_dispatch` is now only used for manual-rerun of reminders.

The final file should retain only the `reminders:` job.

- [ ] **Step 3: Update CLAUDE.md**

Edit `CLAUDE.md`. Find any mention of `/cron/cleanup` or "cleanup cron" and either remove the line or replace the description. Specifically:

a. The Commands section (first code block) — leave the deploy command alone, but in the comment explaining cron jobs:

Replace:
```
- `/cron/reminders` (daily 16:00 UTC) and `/cron/cleanup` (manual only via `workflow_dispatch`) — `Authorization: Bearer $CRON_SECRET`
```

With:
```
- `/cron/reminders` (daily 16:00 UTC) — `Authorization: Bearer $CRON_SECRET`. Also performs daily GC pass on `counters/global_bookings.hourly`.
```

b. Add a new subsection under "Other notes":

```markdown
- **Firestore TTL setup**: four collections rely on Firestore native TTL for retention (replaces the old cleanup cron). One-time per project:

  ```bash
  for COL in notificationLog history counters; do
    gcloud firestore fields ttls update expireAt \
      --collection-group=$COL --enable-ttl \
      --project=strojcek-staging
    gcloud firestore fields ttls update expireAt \
      --collection-group=$COL --enable-ttl \
      --project=strojcek-production
  done
  ```

  Retention windows: `notificationLog` 90d, `history` 365d, `counters/phone_*` + `counters/email_*` 24h after last booking. `counters/global_bookings` has no `expireAt` field so TTL skips it (trimmed inline by booking.ts + reminder cron).
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add .github/workflows/cron.yml CLAUDE.md
git commit -m "feat: remove cleanup cron, replaced by Firestore TTL"
```

---

## Phase D — Server queries + actions

### Task D1: View types for the dashboard

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add view types**

Append to `src/lib/types.ts`:

```ts
import type {
  NotificationKind,
  NotificationStatus,
  NotificationTrigger,
} from "@/server/types/firestore";

export type { NotificationKind, NotificationStatus, NotificationTrigger };

export interface NotificationLogView {
  id: string;
  timestamp: Date;
  kind: NotificationKind;
  status: NotificationStatus;
  appointmentId: string | null;
  recipient: string | null;
  error: string | null;
  durationMs: number | null;
  trigger: NotificationTrigger;
}

export interface NotificationStatsView {
  emailSent: number;
  emailFailed: number;
  smsSent: number;
  smsFailed: number;
  telegramSent: number;
  telegramFailed: number;
}

export interface ProblemsSnapshotView {
  customersWithoutEmail: number;
  customersWithoutPhone: number;
  pendingOver24h: number;
  globalBookingsCurrentHour: number;
  globalBookingsCurrentHourLimit: number;
}

export interface AppointmentNotificationStatusView {
  confirmation: {
    sentAt: Date | null;
    error: string | null;
    attempts: number;
    recipient: string | null;
  };
  cancellation: {
    sentAt: Date | null;
    error: string | null;
    attempts: number;
    recipient: string | null;
  };
  reminderEmail: {
    sentAt: Date | null;
    lockedAt: Date | null;
    recipient: string | null;
  };
  reminderSms: {
    sentAt: Date | null;
    lockedAt: Date | null;
    recipient: string | null;
  };
  telegram: {
    sentAt: Date | null;
    error: string | null;
  };
}
```

> Note: `tsserver` may have already loaded the `NotificationKind` type via `@/server/types/firestore`. The re-export here is so client/UI code doesn't need to reach into `server/types`.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/types.ts
git commit -m "feat(types): notification view types"
```

---

### Task D2: Notification queries

**Files:**
- Create: `src/server/queries/notifications.ts`

- [ ] **Step 1: Create the file**

```ts
import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { tsToDate, tsToDateOrNull } from "@/server/lib/firestore-utils";
import { GLOBAL_BOOKING_LIMIT, TIMEZONE } from "@/lib/constants";
import { hourKey } from "@/server/lib/firestore-utils";
import { subDays } from "date-fns";
import type {
  NotificationLogDoc,
  NotificationKind,
  NotificationStatus,
  AppointmentDoc,
} from "@/server/types/firestore";
import type {
  NotificationLogView,
  NotificationStatsView,
  ProblemsSnapshotView,
  AppointmentNotificationStatusView,
} from "@/lib/types";

function mapLog(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): NotificationLogView {
  const d = doc.data() as NotificationLogDoc;
  return {
    id: doc.id,
    timestamp: tsToDate(d.timestamp),
    kind: d.kind,
    status: d.status,
    appointmentId: d.appointmentId,
    recipient: d.recipient,
    error: d.error,
    durationMs: d.durationMs,
    trigger: d.trigger,
  };
}

interface GetLogOpts {
  limit?: number;
  kind?: NotificationKind;
  status?: NotificationStatus;
  appointmentId?: string;
  sinceMs?: number;
}

export async function getNotificationLog(
  opts: GetLogOpts = {}
): Promise<NotificationLogView[]> {
  let q: FirebaseFirestore.Query = adminDb.collection("notificationLog");
  if (opts.kind) q = q.where("kind", "==", opts.kind);
  if (opts.status) q = q.where("status", "==", opts.status);
  if (opts.appointmentId) q = q.where("appointmentId", "==", opts.appointmentId);
  if (opts.sinceMs) {
    q = q.where("timestamp", ">=", Timestamp.fromMillis(opts.sinceMs));
  }
  q = q.orderBy("timestamp", "desc").limit(opts.limit ?? 100);
  const snap = await q.get();
  return snap.docs.map(mapLog);
}

export async function getNotificationStats(opts: {
  sinceMs: number;
}): Promise<NotificationStatsView> {
  const snap = await adminDb
    .collection("notificationLog")
    .where("timestamp", ">=", Timestamp.fromMillis(opts.sinceMs))
    .get();

  const stats: NotificationStatsView = {
    emailSent: 0,
    emailFailed: 0,
    smsSent: 0,
    smsFailed: 0,
    telegramSent: 0,
    telegramFailed: 0,
  };
  for (const doc of snap.docs) {
    const d = doc.data() as NotificationLogDoc;
    if (d.kind.startsWith("email-")) {
      d.status === "sent" ? stats.emailSent++ : stats.emailFailed++;
    } else if (d.kind === "sms-reminder") {
      d.status === "sent" ? stats.smsSent++ : stats.smsFailed++;
    } else if (d.kind === "telegram-alert") {
      d.status === "sent" ? stats.telegramSent++ : stats.telegramFailed++;
    }
  }
  return stats;
}

export async function getProblemsSnapshot(): Promise<ProblemsSnapshotView> {
  // Customers without email/phone — bounded scan; collection is small (~hundreds).
  const customersSnap = await adminDb.collection("customers").get();
  let withoutEmail = 0;
  let withoutPhone = 0;
  for (const d of customersSnap.docs) {
    const c = d.data() as { email?: string | null; phone?: string | null };
    if (!c.email) withoutEmail++;
    if (!c.phone) withoutPhone++;
  }

  // Pending bookings older than 24h (admin should follow up or cancel).
  const cutoff = Timestamp.fromDate(subDays(new Date(), 1));
  const pendingSnap = await adminDb
    .collection("appointments")
    .where("status", "==", "PENDING")
    .where("createdAt", "<", cutoff)
    .get();
  const pendingOver24h = pendingSnap.size;

  // Current-hour global booking count.
  const globalSnap = await adminDb.doc("counters/global_bookings").get();
  const hourly = globalSnap.exists
    ? ((globalSnap.data() as { hourly?: Record<string, number> }).hourly ?? {})
    : {};
  const currentHourKey = hourKey(new Date());
  const currentCount = hourly[currentHourKey] ?? 0;

  return {
    customersWithoutEmail: withoutEmail,
    customersWithoutPhone: withoutPhone,
    pendingOver24h,
    globalBookingsCurrentHour: currentCount,
    globalBookingsCurrentHourLimit: GLOBAL_BOOKING_LIMIT,
  };
}

export async function getAppointmentNotificationStatus(
  appointmentId: string
): Promise<AppointmentNotificationStatusView | null> {
  const snap = await adminDb.doc(`appointments/${appointmentId}`).get();
  if (!snap.exists) return null;
  const d = snap.data() as AppointmentDoc;
  return {
    confirmation: {
      sentAt: tsToDateOrNull(d.confirmationEmailSentAt),
      error: d.confirmationEmailError ?? null,
      attempts: d.confirmationEmailAttempts ?? 0,
      recipient: d.customerEmail ?? null,
    },
    cancellation: {
      sentAt: tsToDateOrNull(d.cancellationEmailSentAt),
      error: d.cancellationEmailError ?? null,
      attempts: d.cancellationEmailAttempts ?? 0,
      recipient: d.customerEmail ?? null,
    },
    reminderEmail: {
      sentAt: tsToDateOrNull(d.reminderEmailSentAt),
      lockedAt: tsToDateOrNull(d.reminderEmailLockedAt),
      recipient: d.customerEmail ?? null,
    },
    reminderSms: {
      sentAt: tsToDateOrNull(d.reminderSmsSentAt),
      lockedAt: tsToDateOrNull(d.reminderSmsLockedAt),
      recipient: d.customerPhone ?? null,
    },
    telegram: {
      sentAt: tsToDateOrNull(d.telegramAlertSentAt),
      error: d.telegramAlertError ?? null,
    },
  };
}

void TIMEZONE;
```

> The `void TIMEZONE` line silences "unused import" — remove it once any of the queries actually use the constant.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/queries/notifications.ts
git commit -m "feat(queries): notification log + stats + problems snapshot + per-appointment status"
```

---

### Task D3: Resend + manual-run server actions

**Files:**
- Create: `src/server/actions/notifications.ts`

- [ ] **Step 1: Create the file**

```ts
"use server";

import { adminDb } from "@/server/lib/firebase-admin";
import { getSession } from "@/server/lib/auth";
import { sendEmail } from "@/server/lib/email";
import { sendSMS } from "@/server/lib/sms";
import { stripDiacritics } from "@/server/lib/strings";
import { recordNotification } from "@/server/lib/notification-log";
import { bookingConfirmationHtml } from "@/emails/booking-confirmation";
import { bookingCancellationHtml } from "@/emails/booking-cancellation";
import { bookingReminderHtml } from "@/emails/booking-reminder";
import { TIMEZONE } from "@/lib/constants";
import { PUBLIC_SITE_URL, SHOP_PHONE_DISPLAY } from "@/lib/business-info";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { AppointmentDoc } from "@/server/types/firestore";
import { revalidatePath } from "next/cache";

type ActionResult = { success: boolean; error?: string };
const UNAUTH: ActionResult = { success: false, error: "Neautorizovaný prístup." };

export async function resendConfirmationEmail(
  appointmentId: string
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  const snap = await adminDb.doc(`appointments/${appointmentId}`).get();
  if (!snap.exists) return { success: false, error: "Rezervácia nenájdená." };
  const a = snap.data() as AppointmentDoc;
  if (!a.customerEmail)
    return { success: false, error: "Zákazník nemá email." };

  const localStart = toZonedTime(a.startTime.toDate(), TIMEZONE);
  // Resend uses a placeholder cancel URL (raw token isn't recoverable
  // post-create; only the hash is stored). The email points at the
  // public site; the customer can find their booking via the original
  // confirmation. This is consistent with reminder behavior.
  const cancelUrl = `${PUBLIC_SITE_URL}/cancel`;

  const start = Date.now();
  const result = await sendEmail({
    to: a.customerEmail,
    subject: "Potvrdenie rezervácie - Strojček",
    html: bookingConfirmationHtml({
      customerName: a.customerName?.split(" ")[0] ?? "zákazník",
      serviceName: a.serviceName,
      barberName: a.barberName,
      date: format(localStart, "d.M.yyyy"),
      time: format(localStart, "HH:mm"),
      price: (a.priceExpectedCents / 100).toString(),
      cancelUrl,
      startTimeUtc: a.startTime.toDate().toISOString(),
      endTimeUtc: a.endTime.toDate().toISOString(),
    }),
  }).catch((err) => ({ success: false, error: err }) as const);

  await recordNotification({
    kind: "email-confirmation",
    status: result.success ? "sent" : "failed",
    appointmentId,
    recipient: a.customerEmail,
    error: result.success ? null : "send failed",
    durationMs: Date.now() - start,
    trigger: "manual",
  });

  revalidatePath(`/admin/reservations/${appointmentId}`);
  revalidatePath("/admin/notifications");
  return result.success
    ? { success: true }
    : { success: false, error: "Email sa nepodarilo odoslať." };
}

export async function resendCancellationEmail(
  appointmentId: string
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  const snap = await adminDb.doc(`appointments/${appointmentId}`).get();
  if (!snap.exists) return { success: false, error: "Rezervácia nenájdená." };
  const a = snap.data() as AppointmentDoc;
  if (a.status !== "CANCELLED")
    return { success: false, error: "Rezervácia nie je zrušená." };
  if (!a.customerEmail)
    return { success: false, error: "Zákazník nemá email." };

  const localStart = toZonedTime(a.startTime.toDate(), TIMEZONE);
  const start = Date.now();
  const result = await sendEmail({
    to: a.customerEmail,
    subject: "Vaša rezervácia bola zrušená — Strojček",
    html: bookingCancellationHtml({
      customerName: a.customerName || "zákazník",
      serviceName: a.serviceName,
      barberName: a.barberName,
      date: format(localStart, "d.M.yyyy"),
      time: format(localStart, "HH:mm"),
      bookUrl: PUBLIC_SITE_URL,
    }),
  }).catch((err) => ({ success: false, error: err }) as const);

  await recordNotification({
    kind: "email-cancellation",
    status: result.success ? "sent" : "failed",
    appointmentId,
    recipient: a.customerEmail,
    error: result.success ? null : "send failed",
    durationMs: Date.now() - start,
    trigger: "manual",
  });

  revalidatePath(`/admin/reservations/${appointmentId}`);
  revalidatePath("/admin/notifications");
  return result.success
    ? { success: true }
    : { success: false, error: "Email sa nepodarilo odoslať." };
}

export async function runRemindersNow(): Promise<{
  success: boolean;
  error?: string;
  emailSent: number;
  smsSent: number;
  emailFailed: number;
  smsFailed: number;
}> {
  if (!(await getSession()))
    return {
      success: false,
      error: "Neautorizovaný prístup.",
      emailSent: 0,
      smsSent: 0,
      emailFailed: 0,
      smsFailed: 0,
    };

  // Inline copy of the reminder cron logic, with trigger="manual" on
  // every recordNotification call. We don't import from the route file
  // because Next forbids importing a route handler module from a server
  // action; pull the small subset of helpers needed.
  // (The cron route stays the canonical scheduled implementation.)

  const { dateKey } = await import("@/server/lib/firestore-utils");
  const { Timestamp } = await import("firebase-admin/firestore");
  const { addDays } = await import("date-fns");
  const nowLocal = toZonedTime(new Date(), TIMEZONE);
  const tomorrowKey = dateKey(addDays(nowLocal, 1));

  const snap = await adminDb
    .collection("appointments")
    .where("startDateKey", "==", tomorrowKey)
    .where("status", "==", "CONFIRMED")
    .get();

  let emailSent = 0,
    smsSent = 0,
    emailFailed = 0,
    smsFailed = 0;

  const LOCK_TTL_MS = 5 * 60_000;

  for (const doc of snap.docs) {
    const a = doc.data() as AppointmentDoc;
    const ref = doc.ref;

    // Email
    if (
      a.customerEmail &&
      a.reminderEmailSentAt == null &&
      a.reminderSentAt == null
    ) {
      const lockedMs = a.reminderEmailLockedAt?.toMillis() ?? 0;
      if (Date.now() - lockedMs > LOCK_TTL_MS) {
        const claim = await adminDb.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists) return false;
          const fa = fresh.data() as AppointmentDoc;
          if (fa.status !== "CONFIRMED") return false;
          if (fa.reminderEmailSentAt != null || fa.reminderSentAt != null)
            return false;
          const lm = fa.reminderEmailLockedAt?.toMillis() ?? 0;
          if (Date.now() - lm < LOCK_TTL_MS) return false;
          tx.update(ref, { reminderEmailLockedAt: Timestamp.now() });
          return true;
        });
        if (claim) {
          const localStart = toZonedTime(a.startTime.toDate(), TIMEZONE);
          const start = Date.now();
          try {
            const r = await sendEmail({
              to: a.customerEmail,
              subject: "Pripomienka rezervácie — Strojček",
              html: bookingReminderHtml({
                customerName: a.customerName || "zákazník",
                serviceName: a.serviceName,
                barberName: a.barberName,
                date: format(localStart, "d.M.yyyy"),
                time: format(localStart, "HH:mm"),
              }),
            });
            if (!r.success) throw r.error ?? new Error("send failed");
            await ref.update({
              reminderEmailSentAt: Timestamp.now(),
              reminderEmailLockedAt: null,
            });
            emailSent++;
            await recordNotification({
              kind: "email-reminder",
              status: "sent",
              appointmentId: ref.id,
              recipient: a.customerEmail,
              durationMs: Date.now() - start,
              trigger: "manual",
            });
          } catch (err) {
            await ref.update({ reminderEmailLockedAt: null }).catch(() => {});
            emailFailed++;
            await recordNotification({
              kind: "email-reminder",
              status: "failed",
              appointmentId: ref.id,
              recipient: a.customerEmail,
              error: err instanceof Error ? err.message : String(err),
              trigger: "manual",
            });
          }
        }
      }
    }

    // SMS — same pattern with reminderSms* fields.
    if (
      a.customerPhone &&
      a.reminderSmsSentAt == null &&
      a.reminderSentAt == null
    ) {
      const lockedMs = a.reminderSmsLockedAt?.toMillis() ?? 0;
      if (Date.now() - lockedMs > LOCK_TTL_MS) {
        const claim = await adminDb.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists) return false;
          const fa = fresh.data() as AppointmentDoc;
          if (fa.status !== "CONFIRMED") return false;
          if (fa.reminderSmsSentAt != null || fa.reminderSentAt != null)
            return false;
          const lm = fa.reminderSmsLockedAt?.toMillis() ?? 0;
          if (Date.now() - lm < LOCK_TTL_MS) return false;
          tx.update(ref, { reminderSmsLockedAt: Timestamp.now() });
          return true;
        });
        if (claim) {
          const localStart = toZonedTime(a.startTime.toDate(), TIMEZONE);
          const start = Date.now();
          try {
            await sendSMS({
              phone: a.customerPhone,
              message: `Strojcek: zajtra o ${format(localStart, "HH:mm")} mate rezervaciu na ${stripDiacritics(a.serviceName)}. Pre zrusenie zavolajte ${SHOP_PHONE_DISPLAY}.`,
            });
            await ref.update({
              reminderSmsSentAt: Timestamp.now(),
              reminderSmsLockedAt: null,
            });
            smsSent++;
            await recordNotification({
              kind: "sms-reminder",
              status: "sent",
              appointmentId: ref.id,
              recipient: a.customerPhone,
              durationMs: Date.now() - start,
              trigger: "manual",
            });
          } catch (err) {
            await ref.update({ reminderSmsLockedAt: null }).catch(() => {});
            smsFailed++;
            await recordNotification({
              kind: "sms-reminder",
              status: "failed",
              appointmentId: ref.id,
              recipient: a.customerPhone,
              error: err instanceof Error ? err.message : String(err),
              trigger: "manual",
            });
          }
        }
      }
    }
  }

  revalidatePath("/admin/notifications");
  return { success: true, emailSent, smsSent, emailFailed, smsFailed };
}
```

> The duplication between this action and the cron route is intentional: Next.js prevents importing API route handlers from server actions. We accept ~80 lines of repetition to keep the boundaries clean. If repetition becomes a maintenance burden, factor `processEmail`/`processSms` into a shared helper in `src/server/lib/reminders.ts` later.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/actions/notifications.ts
git commit -m "feat(actions): resendConfirmation/Cancellation + runRemindersNow"
```

---

## Phase E — UI

### Task E1: Add sidebar entry

**Files:**
- Modify: `src/components/admin/sidebar.tsx`

- [ ] **Step 1: Update imports + nav array**

In the lucide-react import block, add `BellIcon`:

```ts
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  ScissorsIcon,
  SparklesIcon,
  ClockIcon,
  UsersIcon,
  LogOutIcon,
  MenuIcon,
  BellIcon,
} from "lucide-react";
```

Then update `NAV_ITEMS` — insert the new entry between "Rezervácie" and "Barberi":

```ts
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/calendar", label: "Kalendár", icon: CalendarDaysIcon },
  { href: "/admin/reservations", label: "Rezervácie", icon: ClipboardListIcon },
  { href: "/admin/notifications", label: "Notifikácie", icon: BellIcon },
  { href: "/admin/barbers", label: "Barberi", icon: ScissorsIcon },
  { href: "/admin/services", label: "Služby", icon: SparklesIcon },
  { href: "/admin/schedule", label: "Rozvrh", icon: ClockIcon },
  { href: "/admin/customers", label: "Zákazníci", icon: UsersIcon },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sidebar.tsx
git commit -m "feat(sidebar): add notifications nav entry"
```

---

### Task E2: Resend button component

**Files:**
- Create: `src/components/admin/resend-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2Icon, SendIcon } from "lucide-react";
import { toast } from "sonner";

interface ResendButtonProps {
  action: () => Promise<{ success: boolean; error?: string }>;
  label?: string;
  successMessage?: string;
}

export function ResendButton({
  action,
  label = "Resend",
  successMessage = "Odoslané",
}: ResendButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const r = await action();
        if (r.success) toast.success(successMessage);
        else toast.error(r.error || "Nepodarilo sa odoslať.");
      } catch {
        toast.error("Nepodarilo sa odoslať.");
      }
    });
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? (
        <Loader2Icon className="mr-1.5 size-4 animate-spin" />
      ) : (
        <SendIcon className="mr-1.5 size-4" />
      )}
      {label}
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/admin/resend-button.tsx
git commit -m "feat(admin): ResendButton client component"
```

---

### Task E3: Run-reminders button component

**Files:**
- Create: `src/components/admin/run-reminders-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2Icon, BellRingIcon } from "lucide-react";
import { toast } from "sonner";
import { runRemindersNow } from "@/server/actions/notifications";

export function RunRemindersButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const r = await runRemindersNow();
        if (!r.success) {
          toast.error(r.error || "Nepodarilo sa spustiť.");
          return;
        }
        toast.success(
          `Hotovo: email ${r.emailSent}/${r.emailSent + r.emailFailed}, SMS ${r.smsSent}/${r.smsSent + r.smsFailed}`
        );
        router.refresh();
      } catch {
        toast.error("Nepodarilo sa spustiť.");
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? (
        <Loader2Icon className="mr-2 size-4 animate-spin" />
      ) : (
        <BellRingIcon className="mr-2 size-4" />
      )}
      Spustiť reminder
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/admin/run-reminders-button.tsx
git commit -m "feat(admin): RunRemindersButton"
```

---

### Task E4: Notification status panel for reservation detail

**Files:**
- Create: `src/components/admin/notification-status-panel.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResendButton } from "@/components/admin/resend-button";
import {
  resendConfirmationEmail,
  resendCancellationEmail,
} from "@/server/actions/notifications";
import {
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  MailIcon,
  MessageSquareIcon,
  SendIcon,
} from "lucide-react";
import type {
  AppointmentNotificationStatusView,
  AppointmentStatus,
} from "@/lib/types";

interface PanelProps {
  appointmentId: string;
  appointmentStatus: AppointmentStatus;
  status: AppointmentNotificationStatusView;
}

export function NotificationStatusPanel({
  appointmentId,
  appointmentStatus,
  status,
}: PanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifikácie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <Row
          icon={<MailIcon className="size-4" />}
          label="Confirmation email"
          recipient={status.confirmation.recipient}
          sentAt={status.confirmation.sentAt}
          error={status.confirmation.error}
          attempts={status.confirmation.attempts}
          action={
            status.confirmation.recipient && appointmentStatus !== "CANCELLED"
              ? {
                  label: "Resend",
                  fn: resendConfirmationEmail.bind(null, appointmentId),
                }
              : null
          }
        />
        <Row
          icon={<XCircleIcon className="size-4" />}
          label="Cancellation email"
          recipient={status.cancellation.recipient}
          sentAt={status.cancellation.sentAt}
          error={status.cancellation.error}
          attempts={status.cancellation.attempts}
          neutralWhenEmpty={
            appointmentStatus !== "CANCELLED"
              ? "Rezervácia nezrušená."
              : undefined
          }
          action={
            appointmentStatus === "CANCELLED" && status.cancellation.recipient
              ? {
                  label: "Resend",
                  fn: resendCancellationEmail.bind(null, appointmentId),
                }
              : null
          }
        />
        <ReminderRow
          icon={<MailIcon className="size-4" />}
          label="Reminder email"
          recipient={status.reminderEmail.recipient}
          sentAt={status.reminderEmail.sentAt}
          lockedAt={status.reminderEmail.lockedAt}
        />
        <ReminderRow
          icon={<MessageSquareIcon className="size-4" />}
          label="Reminder SMS"
          recipient={status.reminderSms.recipient}
          sentAt={status.reminderSms.sentAt}
          lockedAt={status.reminderSms.lockedAt}
        />
        <Row
          icon={<SendIcon className="size-4" />}
          label="Telegram alert"
          recipient={null}
          sentAt={status.telegram.sentAt}
          error={status.telegram.error}
          attempts={undefined}
          action={null}
          hideRecipient
        />
      </CardContent>
    </Card>
  );
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  recipient: string | null;
  sentAt: Date | null;
  error: string | null;
  attempts: number | undefined;
  action: { label: string; fn: () => Promise<{ success: boolean; error?: string }> } | null;
  neutralWhenEmpty?: string;
  hideRecipient?: boolean;
}

function Row(props: RowProps) {
  const {
    icon,
    label,
    recipient,
    sentAt,
    error,
    attempts,
    action,
    neutralWhenEmpty,
    hideRecipient,
  } = props;

  const status = error
    ? "failed"
    : sentAt
      ? "sent"
      : neutralWhenEmpty
        ? "neutral"
        : "pending";

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-1 items-start gap-2">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="space-y-0.5">
          <p className="font-medium">{label}</p>
          {status === "sent" && sentAt && (
            <p className="text-muted-foreground text-xs">
              Poslané {format(sentAt, "d.M.yyyy HH:mm", { locale: sk })}
              {!hideRecipient && recipient && ` · ${recipient}`}
              {attempts && attempts > 1 && ` · ${attempts}× pokusov`}
            </p>
          )}
          {status === "failed" && (
            <p className="text-destructive text-xs" title={error ?? undefined}>
              ✗ {error?.slice(0, 80) ?? "Chyba pri odoslaní"}
              {attempts && attempts > 1 && ` (${attempts}× pokusov)`}
            </p>
          )}
          {status === "pending" && (
            <p className="text-muted-foreground text-xs">— Žiadny pokus</p>
          )}
          {status === "neutral" && (
            <p className="text-muted-foreground text-xs">— {neutralWhenEmpty}</p>
          )}
        </div>
      </div>
      {action && <ResendButton action={action.fn} label={action.label} />}
    </div>
  );
}

interface ReminderRowProps {
  icon: React.ReactNode;
  label: string;
  recipient: string | null;
  sentAt: Date | null;
  lockedAt: Date | null;
}

function ReminderRow({ icon, label, recipient, sentAt, lockedAt }: ReminderRowProps) {
  const state = sentAt
    ? "sent"
    : lockedAt
      ? "locked"
      : recipient
        ? "pending"
        : "na";

  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="space-y-0.5">
        <p className="font-medium">{label}</p>
        {state === "sent" && sentAt && (
          <p className="text-muted-foreground text-xs">
            <CheckCircle2Icon className="mr-1 inline size-3" />
            Poslané {format(sentAt, "d.M.yyyy HH:mm", { locale: sk })}
            {recipient && ` · ${recipient}`}
          </p>
        )}
        {state === "locked" && lockedAt && (
          <p className="text-muted-foreground text-xs">
            <ClockIcon className="mr-1 inline size-3" />
            Locked (cron beží alebo zaseknutý) od{" "}
            {format(lockedAt, "d.M.yyyy HH:mm", { locale: sk })}
          </p>
        )}
        {state === "pending" && (
          <p className="text-muted-foreground text-xs">
            — Čaká (pošle sa cez nočný reminder cron)
          </p>
        )}
        {state === "na" && (
          <p className="text-muted-foreground text-xs">
            — Nedostupné (zákazník nemá {label.includes("SMS") ? "telefón" : "email"})
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/admin/notification-status-panel.tsx
git commit -m "feat(admin): NotificationStatusPanel for reservation detail"
```

---

### Task E5: Render panel on reservation detail page

**Files:**
- Modify: `src/app/(admin)/admin/reservations/[id]/page.tsx`

- [ ] **Step 1: Import the panel + the query**

Add to the existing imports at the top:

```ts
import { NotificationStatusPanel } from "@/components/admin/notification-status-panel";
import { getAppointmentNotificationStatus } from "@/server/queries/notifications";
```

- [ ] **Step 2: Fetch the status alongside the appointment**

Find `const appointment = await getAppointmentById(id);`. Replace with parallel fetch:

```ts
  const [appointment, notificationStatus] = await Promise.all([
    getAppointmentById(id),
    getAppointmentNotificationStatus(id),
  ]);
```

- [ ] **Step 3: Render the panel in the right column**

Find the right-column `<div className="space-y-6">` that already contains the "Stav" and "História stavov" cards. Add `<NotificationStatusPanel ... />` as a third card BELOW them:

```tsx
          {notificationStatus && (
            <NotificationStatusPanel
              appointmentId={appointment.id}
              appointmentStatus={appointment.status}
              status={notificationStatus}
            />
          )}
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/\(admin\)/admin/reservations/\[id\]/page.tsx
git commit -m "feat(admin): render NotificationStatusPanel on reservation detail"
```

---

### Task E6: Notifications dashboard page

**Files:**
- Create: `src/app/(admin)/admin/notifications/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import Link from "next/link";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { subDays } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RunRemindersButton } from "@/components/admin/run-reminders-button";
import {
  getNotificationLog,
  getNotificationStats,
  getProblemsSnapshot,
} from "@/server/queries/notifications";

const KIND_LABELS: Record<string, string> = {
  "email-confirmation": "Confirmation email",
  "email-cancellation": "Cancellation email",
  "email-reminder": "Reminder email",
  "sms-reminder": "Reminder SMS",
  "telegram-alert": "Telegram alert",
};

export default async function NotificationsPage() {
  const sinceMs = subDays(new Date(), 7).getTime();
  const [stats, problems, log] = await Promise.all([
    getNotificationStats({ sinceMs }),
    getProblemsSnapshot(),
    getNotificationLog({ limit: 100 }),
  ]);

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">Notifikácie</span>
      </nav>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Notifikácie</h1>
        <RunRemindersButton />
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HealthCard
          label="Email"
          sent={stats.emailSent}
          failed={stats.emailFailed}
        />
        <HealthCard
          label="SMS"
          sent={stats.smsSent}
          failed={stats.smsFailed}
        />
        <HealthCard
          label="Telegram"
          sent={stats.telegramSent}
          failed={stats.telegramFailed}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failed (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">
              {stats.emailFailed + stats.smsFailed + stats.telegramFailed}
            </p>
            <p className="text-xs text-muted-foreground">
              <Link href="/admin/notifications?status=failed" className="underline-offset-2 hover:underline">
                zobraziť
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Problémy</h2>
        <Card>
          <CardContent className="space-y-2 text-sm pt-6">
            <p>
              Customers bez emailu:{" "}
              <span className="font-medium">{problems.customersWithoutEmail}</span>
            </p>
            <p>
              Customers bez telefónu:{" "}
              <span className="font-medium">{problems.customersWithoutPhone}</span>
            </p>
            <p>
              Pending rezervácie {">"}24h:{" "}
              <span className="font-medium">{problems.pendingOver24h}</span>
              {problems.pendingOver24h > 0 && (
                <Link
                  href="/admin/reservations?status=PENDING"
                  className="ml-2 text-xs underline-offset-2 hover:underline"
                >
                  zobraziť
                </Link>
              )}
            </p>
            <p>
              Rate-limit headroom (aktuálna hodina):{" "}
              <span className="font-medium">
                {problems.globalBookingsCurrentHour} / {problems.globalBookingsCurrentHourLimit}
              </span>
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Audit log (posledných 100)</h2>
        <Card>
          <CardContent className="pt-6">
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Zatiaľ žiadne udalosti.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Čas</TableHead>
                    <TableHead>Druh</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Príjemca</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(e.timestamp, "d.M. HH:mm:ss", { locale: sk })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {KIND_LABELS[e.kind] ?? e.kind}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === "sent" ? "default" : "destructive"}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="break-all text-xs">
                        {e.recipient ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.appointmentId ? (
                          <Link
                            href={`/admin/reservations/${e.appointmentId}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            #{e.appointmentId.slice(0, 8)}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {e.error && (
                          <span
                            className="ml-2 text-destructive"
                            title={e.error}
                          >
                            ✗ {e.error.slice(0, 50)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function HealthCard({
  label,
  sent,
  failed,
}: {
  label: string;
  sent: number;
  failed: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label} (7d)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-primary">{sent} ✓</p>
        {failed > 0 && (
          <p className="text-sm text-destructive">{failed} ✗</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/\(admin\)/admin/notifications/page.tsx
git commit -m "feat(admin): notifications dashboard page"
```

---

## Phase F — Verify, document, deploy

### Task F1: TTL behavior verification script

**Files:**
- Create: `scripts/verify-notification-log.ts`

- [ ] **Step 1: Create the script**

```ts
import "dotenv/config";
import { recordNotification } from "../src/server/lib/notification-log";
import { adminDb } from "../src/server/lib/firebase-admin";

const TEST_APPOINTMENT_ID = "verify-script-test";

async function main() {
  console.log("• Writing a test notification log entry…");
  await recordNotification({
    kind: "email-confirmation",
    status: "sent",
    appointmentId: null, // null so we don't try to update a non-existent appointment
    recipient: "verify@example.com",
    durationMs: 42,
    trigger: "manual",
  });

  // Re-read the latest log entry for our recipient.
  const snap = await adminDb
    .collection("notificationLog")
    .where("recipient", "==", "verify@example.com")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (snap.empty) {
    console.error("✗ No log entry found.");
    process.exit(1);
  }

  const data = snap.docs[0].data();
  const checks: Array<[string, boolean]> = [
    ["timestamp present", !!data.timestamp],
    ["expireAt present", !!data.expireAt],
    [
      "expireAt ≈ timestamp + 90d",
      Math.abs(
        data.expireAt.toMillis() -
          data.timestamp.toMillis() -
          90 * 24 * 60 * 60 * 1000
      ) < 60_000,
    ],
    ["kind === email-confirmation", data.kind === "email-confirmation"],
    ["status === sent", data.status === "sent"],
    ["trigger === manual", data.trigger === "manual"],
  ];

  let pass = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) pass = false;
  }

  // Cleanup the verification doc.
  await snap.docs[0].ref.delete();
  console.log("• Cleaned up test doc.");

  if (!pass) {
    console.error("\n❌ Some checks failed.");
    process.exit(1);
  }
  console.log("\n✅ TTL field is set correctly.");
  void TEST_APPOINTMENT_ID;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script (against staging Firestore)**

Run: `npx tsx scripts/verify-notification-log.ts`
Expected: prints `✅ TTL field is set correctly.` and exits 0.

If you don't have local Firebase admin credentials or are running against the live project, this script writes/deletes one doc — safe to run.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-notification-log.ts
git commit -m "test: verify-notification-log script asserts TTL field shape"
```

---

### Task F2: Update existing booking init to include new fields (regression check)

**Files:** depends on what tasks B1/B4 already added

- [ ] **Step 1: Search for any other AppointmentDoc writes that don't yet include the new fields**

Run: `grep -rn "tx.create(apptRef\|tx.create(appointmentRef\|adminDb.doc(\`appointments/\`).set\|.set({" src/server | head -30`

For every match where an appointment doc is created from scratch (not just `tx.update`), verify the 8 new notification fields are present. They should already be in B1/B4, but `updateAppointment` (the edit-existing action) doesn't need them — it only edits.

- [ ] **Step 2: Typecheck + run lint to catch missed required fields**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors. Warnings about `react-hooks/incompatible-library` from existing code are OK.

If TS errors of the form `Property 'confirmationEmailSentAt' is missing` appear, that means an additional create site exists somewhere that we missed. Add the 8 fields there.

- [ ] **Step 3: Commit (only if anything changed)**

```bash
git status
# if anything is modified:
git add -A
git commit -m "fix: ensure all appointment create sites init notification fields"
```

If there's nothing to commit, skip this step.

---

### Task F3: Deploy + manual smoke test on staging

> This task does NOT modify code — it's a deployment + verification checklist.

- [ ] **Step 1: Deploy Firestore rules + indexes to staging**

```bash
firebase deploy --only firestore:rules,firestore:indexes --project=strojcek-staging
```

Expected: rules deploy succeeds; indexes show "creating" or "ready".

- [ ] **Step 2: Configure TTL policies on staging (one-time)**

```bash
for COL in notificationLog history counters; do
  gcloud firestore fields ttls update expireAt \
    --collection-group=$COL --enable-ttl \
    --project=strojcek-staging
done
```

Each command outputs the policy state. If a policy already exists with the same field, gcloud reports "no change".

- [ ] **Step 3: Push to feat/staging branch (App Hosting auto-deploys)**

```bash
git push origin feat/staging
```

Wait for App Hosting to finish the build (~3-5 min). The Firebase Console → App Hosting → strojcek-staging tab shows build progress.

- [ ] **Step 4: Smoke test on staging URL**

1. Open the staging app, create a test booking.
2. Open `/admin/notifications` — confirm the new event appears in audit log within ~5 seconds.
3. Open the booking detail page — confirm the Notifications panel shows the confirmation email as ✓ Sent.
4. Cancel the booking from admin — confirm a new audit log entry for `email-cancellation`.
5. Click Resend on the confirmation email — confirm a new entry with `trigger: manual`.
6. Click "Spustiť reminder" — confirm result toast.
7. Force a failure: edit `EMAIL_PUBLIC_URL` to a bad host, retry Resend, confirm `status: failed` entry with the error message.

- [ ] **Step 5: No commit needed unless a fix is required**

If smoke test reveals a bug, fix it on `feat/staging`, commit, and re-deploy.

---

### Task F4: Production deploy (after staging is verified)

- [ ] **Step 1: Merge feat/staging to main**

```bash
git checkout main
git merge feat/staging --no-edit
git push origin main
```

App Hosting auto-deploys to `strojcek-production` from main.

- [ ] **Step 2: Deploy rules + indexes**

```bash
firebase deploy --only firestore:rules,firestore:indexes --project=strojcek-production
```

- [ ] **Step 3: TTL policies on production**

```bash
for COL in notificationLog history counters; do
  gcloud firestore fields ttls update expireAt \
    --collection-group=$COL --enable-ttl \
    --project=strojcek-production
done
```

- [ ] **Step 4: One-time legacy backlog drain (optional)**

Pre-feature `history` docs and pre-feature `counters/phone_*`/`email_*` docs do NOT have an `expireAt` field — TTL skips them. They are harmless but accumulate. If desired, run a one-time backfill script that reads each existing doc and adds `expireAt`. Skipped here as out-of-scope; the audit log starts clean post-deploy.

---

## Self-Review Checklist

After implementation, verify each spec section maps to at least one task:

- [x] Per-reservation delivery visibility → Tasks A1, B1-B5, D1, D2, E4, E5
- [x] Aggregate notification health → Tasks D2, E6
- [x] Chronological audit log → Tasks A1 (collection type), D2 (query), E6 (UI)
- [x] Manual reminder run → Tasks D3 (action), E3 (button), E6 (page)
- [x] TTL replacement of cleanup cron → Tasks C1, C2, C3, F3 step 2, F4 step 3
- [x] Hourly trim of `global_bookings.hourly` → Task B6 step 4
- [x] `notificationLog` security rule → Task A3
- [x] Composite indexes → Task A4
- [x] CLAUDE.md update → Task C3 step 3
- [x] Workflow update → Task C3 step 2

No placeholders. No "TODO". No "implement later". Every step has the actual content needed.
