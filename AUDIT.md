# Hlbkový Audit — Funkcnost + UI/UX

## BEZPECNOST

### 1. ~~HTML injection v email sablonach~~ ✅ OPRAVENE
**Priorita: Vysoka**

Vsetky 3 email sablony (`src/emails/booking-confirmation.tsx`, `src/emails/booking-reminder.tsx`, `src/emails/booking-cancellation.tsx`) vkladali `customerName`, `serviceName`, `barberName` priamo do HTML bez escapovania.

**Fix:** Vytvoreny `src/emails/utils.ts` s `escapeHtml()`. Vsetky sablony teraz escapuju user input pred vlozenim do HTML.

### 2. Ziadny rate limiting na booking endpoint
**Priorita: Stredna** — OTVORENE

`src/server/actions/booking.ts` — `createBooking` sa da volat neobmedzene. Bot moze spamovat rezervacie, SMS a emaily. Na free plane je to aj financne riziko (SMS stoji peniaze).

---

## LOGICKE PROBLEMY

### 3. ~~Schedule validacia chyba `startTime < endTime`~~ ✅ OPRAVENE
**Priorita: Vysoka**

Admin mohol nastavit rozvrh kde `endTime` je skor ako `startTime` (napr. 18:00-09:00).

**Fix:** Pridany `.refine()` na `scheduleInputSchema` aj `breakInputSchema` v `src/lib/validators.ts` — "Koniec musí byť po začiatku".

### 4. ~~Casova regex akceptuje nerealne hodnoty~~ ✅ OPRAVENE
**Priorita: Vysoka**

`^\d{2}:\d{2}$` akceptovalo `99:99`, `25:61` atd.

**Fix:** Novy zdielany `timeString` validator s `.refine()` — overuje hodiny 0-23 a minuty 0-59. Pouzity v booking, schedule aj break schemy.

### 5. Reminder cron preskoci zakaznikov bez emailu
**Priorita: Nizka** — NERIESI SA

`src/app/api/cron/reminders/route.ts:44` — `if (!appt.customerEmail) continue` preskoci cely zaznam. Kedze email je teraz povinny pre nove rezervacie, toto sa tyka len starych zaznamov.

### 6. ~~Cancel page timezone edge case~~ ✅ OPRAVENE
**Priorita: Stredna**

`toZonedTime(new Date(), TIMEZONE)` + `addHours` porovnavalo local zoned time s UTC `appointment.startTime`.

**Fix:** Zmenene na `addHours(new Date(), MIN_CANCEL_HOURS)` — obe strany porovnania su teraz v UTC.

---

## UI/UX

### 7. ~~Cancel page nema loading state~~ ✅ OPRAVENE
**Priorita: Nizka**

**Fix:** Pridany `src/app/(public)/cancel/loading.tsx` so spinner animaciou.

### 8. ~~Cancel page nema error.tsx~~ ✅ OPRAVENE
**Priorita: Nizka**

**Fix:** Pridany `src/app/(public)/cancel/error.tsx` s SK textom a retry tlacidlom.

### 9. ~~Reminder cron SMS — serverless timing~~ ✅ OPRAVENE
**Priorita: Stredna**

SMS bolo fire-and-forget. Na Verceli mohla function skoncit pred odoslanim.

**Fix:** `sendSMS(...)` zmenene na `await sendSMS(...)` v `src/app/api/cron/reminders/route.ts`.

### 10. ~~Admin — ziadna konfirmacia pred zmazanim~~ ✅ OPRAVENE
**Priorita: Nizka**

**Fix:** Pridany `confirm()` dialog pred zmazanim prestavky v `src/components/admin/schedule-manager.tsx`. (Appointment a customer delete uz mali AlertDialog.)

---

## KONZISTENCIA

### 11. Reminder email neposiela cancelUrl
**Priorita: Nizka** — NERIESI SA

`bookingReminderHtml` ma volitelny `cancelUrl` prop, ale cron ho neposkytuje. Zakaznik v reminder emaili nema moznost kliknut na zrusenie — text hovori "použite odkaz z potvrdzovacieho emailu" co je OK workaround.

### 12. ~~Cancel page footer linky nemaju `prefetch={false}`~~ ✅ OPRAVENE
**Priorita: Nizka**

**Fix:** Pridane `prefetch={false}` na VOP a ochrana udajov linky v cancel page footer.

---

## Sumar

| # | Stav | Co |
|---|------|----|
| 1 | ✅ | HTML escape v email sablonach |
| 2 | ⏳ | Rate limiting (zatial otvorene) |
| 3 | ✅ | Schedule startTime < endTime validacia |
| 4 | ✅ | Time regex — odmietnut nerealne casy |
| 5 | ➖ | SMS reminder pre zakaznikov bez emailu (neriesi sa) |
| 6 | ✅ | Cancel page timezone porovnanie fix |
| 7 | ✅ | Cancel page loading state |
| 8 | ✅ | Cancel page error state |
| 9 | ✅ | Await SMS v reminder crone |
| 10 | ✅ | Admin confirm dialog pred zmazanim |
| 11 | ➖ | cancelUrl v reminder emaili (neriesi sa) |
| 12 | ✅ | prefetch={false} na cancel page |

**9/12 opravených, 1 otvorený (rate limiting), 2 neriešené (nízka priorita)**
