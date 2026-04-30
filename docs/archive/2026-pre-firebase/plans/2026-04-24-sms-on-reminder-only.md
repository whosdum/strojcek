# SMS on Reminder Only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move SMS notification from "immediately on booking" to "together with the day-before reminder email", reword it, and shift the reminder cron to 18:00 Bratislava (summer time) / 17:00 (winter).

**Architecture:** Three surgical edits — remove the confirmation SMS block from `createBooking`, rewrite the SMS message literal in the reminder cron, and adjust the GitHub Actions cron schedule + its matching `if:` filter. No new files, no DB changes.

**Tech Stack:** Next.js 16 server actions, GitHub Actions cron workflow, `date-fns` + `date-fns-tz`, SMStools.sk via `sendSMS`.

**Source spec:** [docs/superpowers/specs/2026-04-24-sms-on-reminder-only-design.md](../specs/2026-04-24-sms-on-reminder-only-design.md)

**Branch:** `feat/per-phone-rate-limit` — continues from the per-phone rate-limit work (stakeholder chose to ship both together).

**Note on testing:** Project has no automated test framework; introducing one is out of scope. Verification is manual + type-check/lint.

---

## File map

| File | Change |
|---|---|
| [src/server/actions/booking.ts](../../../src/server/actions/booking.ts) | Remove `sendSMS` push from `notifications` array (currently lines 204–210). Remove now-unused `sendSMS` import at the top. |
| [src/app/api/cron/reminders/route.ts](../../../src/app/api/cron/reminders/route.ts) | Replace the SMS `message` template literal (line 68) with the new shorter, no-diacritics text. |
| [.github/workflows/cron.yml](../../../.github/workflows/cron.yml) | Change reminder schedule from `0 18 * * *` to `0 16 * * *` UTC in two places: the `schedule:` entry and the `if:` filter on the `reminders` job. Update the comment. |

---

## Task 1: Remove confirmation SMS from `createBooking`

**File:**
- Modify: `src/server/actions/booking.ts` (remove block around lines 204–210 and the `sendSMS` import at line 8)

After this task, a successful booking emits exactly two notifications: the confirmation email and the Telegram ping to the barber. No SMS.

- [ ] **Step 1: Remove the SMS block from the notifications array**

In [src/server/actions/booking.ts](../../../src/server/actions/booking.ts), find this block (currently lines 204–210, inside `createBooking`, sitting between the Email block and the Telegram block):

```ts
    // SMS confirmation
    notifications.push(
      sendSMS({
        phone,
        message: `Rezervácia potvrdená: ${service.name} u ${barberName}, ${formattedDate} o ${formattedTime}. Pre zrusenie zavolajte 0944 932 871 alebo pouzite odkaz v potvrdzujucom emaili.`,
      }).catch((err) => console.error("[SMS]", err))
    );
```

Delete all 7 lines (including the `// SMS confirmation` comment above and the blank line separator if present immediately after, so there is exactly one blank line between the Email and Telegram blocks).

After the deletion, the code around that area should look like:

```ts
      }).catch((err) => console.error("[EMAIL]", err))
    );

    // Telegram notification to barber
    const chatId = process.env.TELEGRAM_CHAT_ID;
```

- [ ] **Step 2: Remove the now-unused `sendSMS` import**

At line 8 of the same file, delete:

```ts
import { sendSMS } from "@/server/lib/sms";
```

`sendSMS` is not used anywhere else in `booking.ts` after Step 1. Do NOT remove the `sendSMS` function itself from `src/server/lib/sms.ts` — the reminder cron still imports it.

- [ ] **Step 3: Verify type-check**

From `/Users/abusfy/Documents/abusfylocal/strojcek`:
```bash
npx tsc --noEmit
```

Expected: exit code 0. If the compiler complains about `sendSMS` being unused or undefined, revisit Step 1/2 — the import and the call site must be removed as a pair.

- [ ] **Step 4: Verify lint (informational)**

```bash
npm run lint
```

Pre-existing error in `scripts/create-admin.ts` causes exit code 1 — that is not your concern. Confirm no NEW warnings or errors appear in `src/server/actions/booking.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/booking.ts
git commit -m "feat: remove confirmation SMS from booking flow"
```

---

## Task 2: Reword the reminder SMS text

**File:**
- Modify: `src/app/api/cron/reminders/route.ts` (line ~68 — the `message` literal)

The SMS is now the only SMS the customer gets. Rewrite so it stands alone: give the time, the service name, and a cancel channel. No diacritics → single GSM-7 segment (cheaper).

- [ ] **Step 1: Replace the SMS message literal**

In [src/app/api/cron/reminders/route.ts](../../../src/app/api/cron/reminders/route.ts), find the `sendSMS` call (inside the `for` loop, currently around lines 65–72):

```ts
      // Send SMS reminder
      if (appt.customerPhone) {
        await sendSMS({
          phone: appt.customerPhone,
          message: `Pripomienka: zajtra ${format(toZonedTime(appt.startTime, TIMEZONE), "HH:mm")} máte rezerváciu v Strojčeku (${appt.service.name}). Ak potrebujete zrušiť, použite odkaz z potvrdzovacieho emailu.`,
        }).catch((err) =>
          console.error(`[cron/reminders] SMS failed for ${appt.id}:`, err)
        );
      }
```

Replace the block with:

```ts
      // Send SMS reminder
      if (appt.customerPhone) {
        await sendSMS({
          phone: appt.customerPhone,
          message: `Strojcek: zajtra o ${format(toZonedTime(appt.startTime, TIMEZONE), "HH:mm")} mate rezervaciu na ${appt.service.name}. Pre zrusenie zavolajte 0944 932 871.`,
        }).catch((err) =>
          console.error(`[cron/reminders] SMS failed for ${appt.id}:`, err)
        );
      }
```

Only the `message` string changes. The `if` guard, the `await sendSMS(...)`, and the `.catch()` handler are identical.

Key invariants to preserve:
- Still inside the `if (appt.customerPhone)` guard (don't attempt SMS when phone is null).
- Still uses `format(toZonedTime(appt.startTime, TIMEZONE), "HH:mm")` — do not simplify to `appt.startTime` (that would print a UTC ISO string).
- Still uses `appt.service.name` (service name) — do not accidentally reference `barber` or a non-existent `appt.service` shape.
- No diacritics in the new message. Copy it exactly.

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/reminders/route.ts
git commit -m "feat: reword reminder SMS for standalone use"
```

---

## Task 3: Shift the reminder cron to 16:00 UTC

**File:**
- Modify: `.github/workflows/cron.yml` (schedule entry, `if:` filter, comment)

After this task, the reminder job fires at 16:00 UTC daily → 18:00 Bratislava during CEST (summer) and 17:00 during CET (winter). Stakeholder prefers the summer alignment.

- [ ] **Step 1: Update the schedule block and the reminders job filter**

In [.github/workflows/cron.yml](../../../.github/workflows/cron.yml), find the block:

```yaml
on:
  schedule:
    # Reminders — daily at 18:00 UTC (20:00 Bratislava summer / 19:00 winter)
    - cron: "0 18 * * *"
    # Cleanup — daily at 03:00 UTC
    - cron: "0 3 * * *"
  workflow_dispatch: # allow manual trigger

jobs:
  reminders:
    if: github.event.schedule == '0 18 * * *' || github.event_name == 'workflow_dispatch'
```

Replace it with:

```yaml
on:
  schedule:
    # Reminders — daily at 16:00 UTC (18:00 Bratislava summer / 17:00 winter)
    - cron: "0 16 * * *"
    # Cleanup — daily at 03:00 UTC
    - cron: "0 3 * * *"
  workflow_dispatch: # allow manual trigger

jobs:
  reminders:
    if: github.event.schedule == '0 16 * * *' || github.event_name == 'workflow_dispatch'
```

Two character-level changes: `18` → `16` in the schedule line, its comment, and the `if:` guard. Do NOT touch the cleanup cron (`0 3 * * *`) or the cleanup job's `if:` filter.

- [ ] **Step 2: Validate YAML parses cleanly (sanity)**

The repo doesn't have a YAML validator configured, but you can do a quick sanity check by parsing with Node:

```bash
node -e "const fs=require('fs'); const yaml=fs.readFileSync('.github/workflows/cron.yml','utf8'); console.log('OK, bytes:', yaml.length); if (!yaml.includes('0 16 * * *')) { console.error('new schedule missing'); process.exit(1); } if (yaml.includes('0 18 * * *')) { console.error('old schedule still present'); process.exit(1); } console.log('schedule substitutions verified');"
```

Expected: prints `OK, bytes: <number>` and `schedule substitutions verified`.

(We don't need a full YAML parse — GitHub will validate the file on the next workflow run. This just catches dumb find/replace mistakes.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/cron.yml
git commit -m "chore(ci): run reminder cron at 16:00 UTC"
```

---

## Self-review checklist (after all tasks complete)

- [ ] `src/server/actions/booking.ts` no longer imports `sendSMS` and no longer calls it. Grep: `grep -n "sendSMS" src/server/actions/booking.ts` should return nothing.
- [ ] `src/app/api/cron/reminders/route.ts` still imports and calls `sendSMS` — reminder flow intact. Grep: `grep -n "sendSMS" src/app/api/cron/reminders/route.ts` should return two lines (import + call).
- [ ] The new SMS message string contains `"Strojcek: zajtra o"` and `"Pre zrusenie zavolajte 0944 932 871."` and no Slovak diacritics (no `á/é/í/ó/ú/č/š/ž/ť/ň/ľ/ď/ý`).
- [ ] `.github/workflows/cron.yml` contains `"0 16 * * *"` exactly twice (once in `schedule:`, once in the `if:` filter of the `reminders` job) and does NOT contain `"0 18 * * *"` anywhere.

---

## Spec coverage map

| Spec section | Covered by |
|---|---|
| Remove SMS from `createBooking` | Task 1 |
| Remove unused `sendSMS` import | Task 1 Step 2 |
| Reword reminder SMS (no diacritics, new copy) | Task 2 |
| Shift cron to `0 16 * * *` UTC | Task 3 |
| Update workflow `if:` filter | Task 3 Step 1 |
| Update workflow comment | Task 3 Step 1 |
| Short-notice bookings get no SMS (decision A) | Implicit — no code required; documented in spec non-goals |
| Manual verification plan (confirmation flow + reminder flow + workflow_dispatch) | Spec §Testing — done by human after merge |

---

## Rollback

Each task is an independent commit. Rollback options in increasing scope:

- Revert Task 3 only → cron returns to 18:00 UTC (SMS changes stay).
- Revert Task 2 only → old SMS wording returns (still fires at 16:00 UTC).
- Revert Tasks 1–3 → full pre-feature behavior (confirmation SMS + old reminder SMS + 18:00 UTC cron).

No DB changes to undo.
