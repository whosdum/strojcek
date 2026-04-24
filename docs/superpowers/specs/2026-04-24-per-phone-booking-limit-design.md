# Per-phone booking rate limit — Design

**Date:** 2026-04-24
**Status:** Approved, ready for implementation plan

## Problem

The public booking endpoint (`createBooking` server action in `src/server/actions/booking.ts`) sends a confirmation SMS and email for every successful booking. Today it has only one abuse guard: a global rate limit of 30 online bookings per hour. There is no per-phone, per-IP, or CAPTCHA protection.

A bot hitting the form in a loop can therefore:

- Send up to ~720 SMS / ~720 emails per day (30/h × 24h)
- Block ~720 real appointment slots with fake bookings (DoS on legitimate customers)

The SMS gateway (SMStools.sk) is billed per message. Even below the 720/day ceiling, sustained abuse is costly, and the slot-blocking side effect is worse than the message cost.

## Goal

Add a per-phone booking limit: **maximum 3 online bookings per phone number in any rolling 24-hour window**. Real customers who legitimately need a 4th booking in a day call the shop (0944 932 871).

This shrinks the single-phone attack surface from "unlimited within the global cap" to "3 per day per phone". Combined with the existing global cap, an attacker now needs many distinct phone numbers to inflict meaningful damage.

## Non-goals

Explicitly out of scope for this change:

- CAPTCHA (e.g. Cloudflare Turnstile)
- Per-IP rate limit
- Phone ownership verification (OTP)
- Automated tests / test framework setup
- Logging or alerting when the limit is hit
- Changes to admin-created bookings

## Design decisions

All previously agreed with the stakeholder:

| Decision | Choice | Rationale |
|---|---|---|
| Do CANCELLED / NO_SHOW bookings count toward the limit? | **Yes, all statuses count** | Prevents a book → cancel → re-book abuse loop. Real customers who change their mind 4× per day can call. |
| Does the limit apply to admin-created bookings? | **No — only `source: "online"` counts** | Admin must remain able to help any customer, including one who has already hit their limit. Admin-created bookings do not go through the public endpoint and are not part of the abuse surface. |
| Limit value | **3 bookings per rolling 24h** | Stakeholder-chosen. |
| Window type | **Rolling 24h from `createdAt`** | Simpler than calendar-day logic; aligns with how the existing global 30/h limit works. |
| Error message | *"Dosiahli ste maximálny počet rezervácií za 24 hodín. Pre ďalšiu rezerváciu zavolajte na 0944 932 871."* | Clear actionable guidance for a real customer. Exact count (3) intentionally omitted so attackers don't trivially learn the threshold. |

## Architecture

Keep the same shape as the existing `GLOBAL_BOOKING_LIMIT` guard — a `prisma.appointment.count()` call early in `createBooking`, returning `{ success: false, error }` if the limit is reached. No new files, no new dependencies.

### Where the check runs

Inside `createBooking` in `src/server/actions/booking.ts`, immediately after `normalizePhone(data.phone)` and **before** the existing global 30/h check. Running before the global check means a bot hammering from one phone is rejected on the cheaper per-phone query first; the global check then still catches distributed bursts.

### Query shape

```ts
const twentyFourHoursAgo = subHours(new Date(), 24);
const phoneCount = await prisma.appointment.count({
  where: {
    customerPhone: phone,           // already normalized
    source: "online",                // exclude admin-created
    createdAt: { gte: twentyFourHoursAgo },
  },
});
if (phoneCount >= PHONE_BOOKING_LIMIT_24H) {
  return {
    success: false,
    error: "Dosiahli ste maximálny počet rezervácií za 24 hodín. Pre ďalšiu rezerváciu zavolajte na 0944 932 871.",
  };
}
```

No filter on `status` — `CANCELLED` and `NO_SHOW` bookings count too (decision above).

### Constants relocation

Both rate-limit values move from `src/server/actions/booking.ts` into `src/lib/constants.ts`, the existing home for business rules per `CLAUDE.md`:

- `GLOBAL_BOOKING_LIMIT = 30`
- `PHONE_BOOKING_LIMIT_24H = 3`

`booking.ts` imports both instead of declaring `GLOBAL_BOOKING_LIMIT` locally.

## Database / migration

`Appointment.customerPhone` is currently not indexed. Without an index, the new `count` query does a sequential scan over the `appointments` table — acceptable today (small table), but degrades as bookings grow and would render the protection ineffective under load.

Add a composite index in `prisma/schema.prisma`:

```prisma
@@index([customerPhone, createdAt])
```

Generate the migration with `npx prisma migrate dev --name add_phone_createdat_index`.

### Production migration

`package.json` currently has:

```json
"build": "prisma generate && next build"
```

This does **not** apply pending migrations. To make this deploy cleanly, the build script becomes:

```json
"build": "prisma migrate deploy && prisma generate && next build"
```

`prisma migrate deploy` is the production-safe command (non-interactive, applies pending migrations only). After this change, future migrations in this repo will also auto-apply on deploy.

## Error handling

The existing `{ success: false, error: string }` return shape is reused. The booking wizard (`BookingWizard` component) already renders `error` strings; no frontend changes needed.

There is still a small TOCTOU race: two concurrent requests from the same phone can both read `count = 2` and each insert, arriving at 4. This race is:

- Bounded (at most N concurrent-request-overshoot per window)
- Matches the behavior of the existing global limit, which has the same race
- Not worth fixing with advisory locks or a DB-level constraint at this scope

If perfect enforcement is later needed, a unique partial index or `SELECT … FOR UPDATE` could be added; out of scope for now.

## Testing

No automated tests in the project today; introducing a framework is out of scope. Manual verification plan:

1. **Happy path** — book 1×, 2×, 3× with the same phone on different open slots → all succeed.
2. **Limit hit** — 4th attempt on same phone → error message returned; no SMS sent; no appointment created.
3. **Cancelled count** — book 3×, cancel all via `/cancel`, try a 4th → still blocked (decision: cancelled count toward limit).
4. **Different phone** — once a phone is rate-limited, an unrelated phone still books successfully → limit is per-phone, not global.
5. **Admin escape hatch** — from the admin panel, create a booking for an already-rate-limited phone → succeeds (filter on `source: "online"` excludes admin bookings).
6. **Window expiry** (optional) — update the oldest appointment's `createdAt` in DB to 25h ago → the phone can book again.

## Affected files

| File | Change |
|---|---|
| `src/lib/constants.ts` | Add `GLOBAL_BOOKING_LIMIT_PER_HOUR` and `PHONE_BOOKING_LIMIT_24H` exports. |
| `src/server/actions/booking.ts` | Import both constants, remove local `GLOBAL_BOOKING_LIMIT`, add per-phone count check before existing global check. |
| `prisma/schema.prisma` | Add `@@index([customerPhone, createdAt])` to `Appointment`. |
| `prisma/migrations/…_add_phone_createdat_index/` | New migration (generated by Prisma). |
| `package.json` | Update `build` script to run `prisma migrate deploy` first. |

## Risk & rollback

- **Migration risk:** The new index is an additive change; no data modification, no column drops. Safe to deploy. If performance issues appear, the migration can be rolled back by deleting the index in a new migration.
- **Logic risk:** The per-phone check is a new `return` path before any mutation. If buggy, it can only produce false positives (legitimate customers incorrectly rejected) — it cannot corrupt data.
- **Rollback:** Revert the commit. The index can stay in place harmlessly; if undesired, drop it with a follow-up migration.
