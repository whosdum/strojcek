# Archive — pre-Firebase implementation plans (Mar–Apr 2026)

These are the original brainstorming, design specs and implementation plans from the **first iteration** of the Strojcek project, when the stack was:

- **Postgres** (with `EXCLUDE` constraint for slot conflict)
- **Prisma 7** ORM (`prisma migrate deploy` in build script)
- **Better Auth** for admin authentication
- **Resend** for transactional email
- **GatewayAPI** for SMS
- **Vercel** as the deploy target (Vercel Cron for reminders)
- **Supabase** as the Postgres host

That implementation was completed and ran in production briefly. In **late April 2026** the stack was rewritten to:

- **Firestore** + **Firebase Auth** + **Firebase App Hosting**
- **Nodemailer** (SMTP) for email
- **SMSTools.sk** for SMS
- **GitHub Actions** cron hitting `/api/cron/*` endpoints

The documents in this folder are kept **only for historical reference** — they describe APIs, schemas, ORM calls and infrastructure that no longer exist in the codebase. **Do not use them as a guide for current development.** See [CLAUDE.md](../../../CLAUDE.md) and the project [README.md](../../../README.md) for the current architecture.

## Contents

```
plans/
  2026-03-15-barber-shop-implementation.md   — original 16-task implementation plan (Prisma, Better Auth, Resend, GatewayAPI)
  2026-04-24-per-phone-booking-limit.md      — adding 3-bookings/24h-per-phone guard via Prisma index
  2026-04-24-sms-on-reminder-only.md         — moving SMS from booking confirmation to reminder-only
specs/
  2026-03-15-barber-shop-booking-design.md   — full architectural spec for the original Postgres + Prisma stack
  2026-04-24-per-phone-booking-limit-design.md
  2026-04-24-sms-on-reminder-only-design.md
  2026-04-27-admin-reservation-crud-design.md
```
