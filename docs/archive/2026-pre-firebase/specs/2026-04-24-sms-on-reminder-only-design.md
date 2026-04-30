# SMS only on day-before reminder — Design

**Date:** 2026-04-24
**Status:** Approved, ready for implementation plan
**Branch:** `feat/per-phone-rate-limit` (continues on the same branch per stakeholder choice)

## Problem

Today, `createBooking` in `src/server/actions/booking.ts` sends three notifications on every successful booking: confirmation email, confirmation SMS, and Telegram to the barber. The reminder cron at `src/app/api/cron/reminders/route.ts` then sends a second email + SMS the day before the appointment.

Customers therefore get two SMS per booking. The stakeholder wants SMS to be sent **once, together with the reminder email**, the evening before the appointment (around 18:00 Bratislava local time). Confirmation flow keeps the email and the Telegram ping — no SMS.

## Goal

- Remove the SMS call from `createBooking`.
- Keep the reminder cron's SMS, but reword it so it stands alone (since it is now the only SMS the customer will receive).
- Move the reminder cron schedule from `0 18 * * *` UTC (20:00 CEST / 19:00 CET) to `0 16 * * *` UTC (18:00 CEST / 17:00 CET).

## Non-goals

Explicitly out of scope:

- Catching bookings made less than a day before the appointment — these receive no SMS. Acknowledged and accepted by the stakeholder (decision A below).
- A second short-notice cron.
- Changing the confirmation email, the cancellation email, or the reminder email HTML.
- Changing the Telegram notification.
- Any DB schema or data-model changes.
- Backfilling SMS for already-booked appointments.

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Short-notice bookings (< 24h before appointment) — should they still get an SMS? | **No — accept no SMS** | Confirmation email still informs the customer. Keeps implementation small; no extra cron. |
| DST strategy for the reminder cron? | **Prefer summer time — `0 16 * * *` UTC** | Summer → 18:00 Bratislava exactly. Winter → 17:00 Bratislava (still evening, still clearly an actionable reminder). |
| New SMS text (variant A) | `"Strojcek: zajtra o {time} mate rezervaciu na {service}. Pre zrusenie zavolajte 0944 932 871."` | ~115 chars, no diacritics → one GSM-7 segment (cheaper than current multi-segment UCS-2). Contains time, service, and a cancel channel. |
| Branch strategy | **Continue on `feat/per-phone-rate-limit`** | Stakeholder preference. Both changes touch `createBooking`; they will ship together as "SMS/abuse hardening". |

## Architecture

No new files, no data-model changes. Three surgical edits:

### 1. `src/server/actions/booking.ts`

Delete the SMS block that pushes `sendSMS(...)` into the `notifications` array (currently lines 182–188). Leave the `import { sendSMS } ...` line intact because the reminder cron still uses it — wait, that import is local to `booking.ts`; the cron has its own import. Remove the `sendSMS` import from `booking.ts` to avoid an unused-import warning.

The `sendEmail` confirmation and the Telegram notification blocks are not touched.

### 2. `src/app/api/cron/reminders/route.ts`

Replace the SMS `message` string. Current wording (line 68):
```
`Pripomienka: zajtra ${time} máte rezerváciu v Strojčeku (${service.name}). Ak potrebujete zrušiť, použite odkaz z potvrdzovacieho emailu.`
```

New wording:
```
`Strojcek: zajtra o ${time} mate rezervaciu na ${service.name}. Pre zrusenie zavolajte 0944 932 871.`
```

Where `{time}` is the existing `format(toZonedTime(appt.startTime, TIMEZONE), "HH:mm")`. No structural changes to the route — only the message literal.

### 3. `.github/workflows/cron.yml`

Change the reminder cron schedule from `0 18 * * *` to `0 16 * * *`:

- Update the `schedule:` entry and its comment: `# Reminders — daily at 16:00 UTC (18:00 Bratislava summer / 17:00 Bratislava winter)`.
- Update the `if:` condition on the `reminders` job from `github.event.schedule == '0 18 * * *'` to `github.event.schedule == '0 16 * * *'`.
- Leave the cleanup cron (`0 3 * * *`) untouched.

## Affected files

| File | Change |
|---|---|
| `src/server/actions/booking.ts` | Remove SMS push in notifications array; remove the now-unused `sendSMS` import. |
| `src/app/api/cron/reminders/route.ts` | Rewrite the SMS `message` literal only. |
| `.github/workflows/cron.yml` | Change reminder cron from `0 18` to `0 16` UTC; update matching `if:` filter and comment. |

## Testing

No automated tests. Manual verification:

1. **Confirmation SMS is gone:** Start `npm run dev`, book an appointment from the wizard with a real phone. Expected: confirmation email arrives; **no** SMS is sent (`[SMS STUB]` log if no API key, or no actual send if the hook is fully wired). Telegram notification still fires.
2. **Reminder SMS text is correct:** Seed an appointment whose `startTime` is tomorrow and whose `status = CONFIRMED` and `reminderSentAt IS NULL`. Manually invoke the cron endpoint:
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
   ```
   Expected: response `{ ok: true, found: 1, sent: 1 }`, reminder email arrives, SMS arrives with the new wording.
3. **Short-notice booking → no SMS:** Book an appointment for later today. Expected: no SMS is sent on creation; cron next evening won't fire for it because the appointment has already passed.
4. **GitHub workflow:** After merging, use the workflow's `workflow_dispatch` trigger from the GitHub Actions UI to confirm the reminder job runs successfully at the new schedule.

## Error handling

No new error paths. Existing `.catch()` blocks handle SMS/email failures without blocking the flow. If the cron's SMS send fails, the email still goes out; `reminderSentAt` is still set (current behavior — fix is out of scope here).

## Rollback

Revert the 2–3 commits. No data changes to undo. DST change in the workflow takes effect on the next scheduled run after merge.
