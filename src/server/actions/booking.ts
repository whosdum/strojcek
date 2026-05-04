"use server";

import { Timestamp } from "firebase-admin/firestore";
import { addDays, addMinutes, format, addHours, isBefore, parseISO, subHours } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { randomUUID } from "crypto";

import { adminDb } from "@/server/lib/firebase-admin";
import {
  dateKey,
  generateSearchTokens,
  hourKey,
  stripUndefined,
} from "@/server/lib/firestore-utils";
import {
  bookingInputSchema,
  cancelBookingInputSchema,
} from "@/lib/validators";
import { normalizePhone } from "@/server/lib/phone";
import {
  generateToken,
  getTokenLookupValues,
  hashToken,
} from "@/server/lib/tokens";
import { sendEmail } from "@/server/lib/email";
import {
  escapeTelegramHtml,
  sendTelegramNotification,
} from "@/server/lib/telegram";
import { bookingConfirmationHtml } from "@/emails/booking-confirmation";
import { bookingCancellationHtml } from "@/emails/booking-cancellation";
import {
  MIN_CANCEL_HOURS,
  CANCELLABLE_STATUSES,
  TIMEZONE,
  GLOBAL_BOOKING_LIMIT,
  PHONE_BOOKING_LIMIT_24H,
  EMAIL_BOOKING_LIMIT_24H,
} from "@/lib/constants";
import { createHash } from "crypto";
import { PUBLIC_SITE_URL, SHOP_PHONE_DISPLAY } from "@/lib/business-info";
import { recordNotification } from "@/server/lib/notification-log";
import type { AppointmentStatus } from "@/lib/types";
import type {
  AppointmentDoc,
  BarberDoc,
  BarberServiceDoc,
  ScheduleDoc,
  ScheduleBreakDoc,
  ScheduleOverrideDoc,
} from "@/server/types/firestore";

type ActionResult = {
  success: boolean;
  error?: string;
  /** When set, the wizard surfaces the message under the matching field
   *  in the contact form instead of as a generic banner. */
  field?: "firstName" | "lastName" | "phone" | "email" | "note";
  appointmentId?: string;
  /** True when the customer confirmation email failed to send. The
   *  booking itself is still committed; the UI surfaces a warning so
   *  the customer can save the cancel-link or contact the shop. */
  emailFailed?: boolean;
};

const PHONE_COUNTER_DOC = (phone: string) => `counters/phone_${phone}`;
const GLOBAL_COUNTER_DOC = "counters/global_bookings";
/** Hashed so the doc id doesn't expose the email in plaintext if the
 *  counters collection ever leaks. The hash is one-way; collisions are
 *  not a concern at this scale. */
const EMAIL_COUNTER_DOC = (email: string) =>
  `counters/email_${createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 32)}`;

export async function createBooking(input: unknown): Promise<ActionResult> {
  try {
    // Honeypot: a hidden "website" input that real users never see.
    // Naive bots that auto-fill every text field will set it; we return
    // a synthetic success so they don't learn to bypass the trap.
    if (
      typeof input === "object" &&
      input !== null &&
      typeof (input as { website?: unknown }).website === "string" &&
      (input as { website: string }).website.trim() !== ""
    ) {
      console.warn("[booking] honeypot triggered");
      return { success: true, appointmentId: "honeypot" };
    }

    const data = bookingInputSchema.parse(input);
    const phone = normalizePhone(data.phone);

    // Pre-load barber + barber-service + schedule context (outside the
    // transaction; schedule mutations are admin-only and rare, so a
    // ~ms race window is acceptable).
    const localDateForDay = toZonedTime(
      fromZonedTime(`${data.date}T00:00:00`, TIMEZONE),
      TIMEZONE
    );
    const dayOfWeek = localDateForDay.getDay();

    const [barberSnap, bsSnap, overrideSnap, scheduleSnap, breaksSnap] =
      await Promise.all([
        adminDb.doc(`barbers/${data.barberId}`).get(),
        adminDb.doc(`barbers/${data.barberId}/services/${data.serviceId}`).get(),
        adminDb.doc(`barbers/${data.barberId}/overrides/${data.date}`).get(),
        adminDb.doc(`barbers/${data.barberId}/schedules/${dayOfWeek}`).get(),
        adminDb
          .collection(`barbers/${data.barberId}/breaks`)
          .where("dayOfWeek", "==", dayOfWeek)
          .get(),
      ]);
    if (!barberSnap.exists || !bsSnap.exists) {
      return { success: false, error: "Barber neponúka túto službu." };
    }
    const barber = barberSnap.data() as BarberDoc;
    const bs = bsSnap.data() as BarberServiceDoc;

    // Booking horizon — public bookings only (admin appointment-form uses
    // its own action and intentionally has no upper bound). Compare
    // requested-vs-horizon as Bratislava-local YYYY-MM-DD strings so the
    // window matches what the customer sees in the wizard, even when the
    // server runs in UTC and Bratislava midnight has already passed.
    const horizonWeeks = barber.bookingHorizonWeeks ?? 3;
    const todayKey = new Date().toLocaleDateString("en-CA", {
      timeZone: TIMEZONE,
    });
    if (data.date < todayKey) {
      return {
        success: false,
        error: "Termín v minulosti nie je možné rezervovať.",
      };
    }
    const horizonEnd = addDays(parseISO(todayKey), horizonWeeks * 7);
    const horizonEndKey = format(horizonEnd, "yyyy-MM-dd");
    if (data.date > horizonEndKey) {
      return {
        success: false,
        error: `Termín je príliš ďaleko v budúcnosti. Rezervovať je možné najviac ${horizonWeeks} týždňov dopredu.`,
      };
    }
    const duration = bs.customDuration ?? bs.defaultDuration;
    const buffer = bs.bufferMinutes;
    const priceCents = bs.customPriceCents ?? bs.defaultPriceCents;

    const startTime = fromZonedTime(`${data.date}T${data.time}:00`, TIMEZONE);
    const endTime = addMinutes(startTime, duration);
    const startKey = dateKey(startTime);

    // The wizard's slot generator already filters past slots, so a
    // submission with startTime < now arrives only via stale state or a
    // hand-crafted POST. Reject explicitly rather than relying on the
    // overlap check (which doesn't inspect time-vs-now).
    if (startTime.getTime() < Date.now()) {
      return {
        success: false,
        error: "Termín v minulosti nie je možné rezervovať.",
      };
    }

    // Re-derive the schedule window the slot generator would have used —
    // override beats schedule. This catches submissions of slots that
    // were valid when the wizard fetched them but became invalid before
    // submit (admin disabled the day, set custom hours, added a break).
    let workStart: string;
    let workEnd: string;
    let usingOverride = false;

    if (overrideSnap.exists) {
      const o = overrideSnap.data() as ScheduleOverrideDoc;
      if (!o.isAvailable || !o.startTime || !o.endTime) {
        return {
          success: false,
          error: "Tento deň je zatvorený. Vyberte iný termín.",
        };
      }
      workStart = o.startTime;
      workEnd = o.endTime;
      usingOverride = true;
    } else {
      if (!scheduleSnap.exists) {
        return {
          success: false,
          error: "Tento deň je zatvorený. Vyberte iný termín.",
        };
      }
      const s = scheduleSnap.data() as ScheduleDoc;
      if (!s.isActive) {
        return {
          success: false,
          error: "Tento deň je zatvorený. Vyberte iný termín.",
        };
      }
      workStart = s.startTime;
      workEnd = s.endTime;
    }

    const workingStartUtc = fromZonedTime(`${data.date}T${workStart}:00`, TIMEZONE);
    const workingEndUtc = fromZonedTime(`${data.date}T${workEnd}:00`, TIMEZONE);
    if (
      startTime.getTime() < workingStartUtc.getTime() ||
      endTime.getTime() > workingEndUtc.getTime()
    ) {
      return {
        success: false,
        error: "Tento termín je mimo pracovných hodín.",
      };
    }

    // Breaks apply on regular schedule days only — overrides take a
    // single explicit window and ignore the recurring breaks.
    if (!usingOverride) {
      const newBlockEndMs = endTime.getTime() + buffer * 60_000;
      const breakConflict = breaksSnap.docs.some((d) => {
        const b = d.data() as ScheduleBreakDoc;
        const bStart = fromZonedTime(
          `${data.date}T${b.startTime}:00`,
          TIMEZONE
        );
        const bEnd = fromZonedTime(`${data.date}T${b.endTime}:00`, TIMEZONE);
        return startTime.getTime() < bEnd.getTime() && newBlockEndMs > bStart.getTime();
      });
      if (breakConflict) {
        return {
          success: false,
          error: "Tento termín zasahuje do prestávky. Vyberte iný čas.",
        };
      }
    }

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const appointmentId = randomUUID();
    const phoneIdxRef = adminDb.doc(`customerPhones/${phone}`);

    // === Atomic transaction ===
    // Reads must all run before any writes (Firestore tx invariant).
    // Customer get-or-create lives in this same tx so two concurrent
    // bookings with the same phone resolve to one customerId, and so
    // a failed booking doesn't leave an orphan customer + phone index.
    let customerId = "";
    try {
      await adminDb.runTransaction(async (tx) => {
        const now = new Date();
        const nowTs = Timestamp.fromDate(now);

        // === READS ===
        // 0. Customer phone index
        const phoneIdxSnap = await tx.get(phoneIdxRef);
        const existingCustomerId = phoneIdxSnap.exists
          ? (phoneIdxSnap.data() as { customerId: string }).customerId
          : null;
        const existingCustomerSnap = existingCustomerId
          ? await tx.get(adminDb.doc(`customers/${existingCustomerId}`))
          : null;

        // 1. Per-phone 24h rate limit
        const phoneCounterRef = adminDb.doc(PHONE_COUNTER_DOC(phone));
        const phoneCounterSnap = await tx.get(phoneCounterRef);
        const cutoff24h = subHours(now, 24).getTime();
        const existingPhone: Timestamp[] = phoneCounterSnap.exists
          ? (phoneCounterSnap.data()?.bookings ?? [])
          : [];
        const recentPhone = existingPhone.filter(
          (t) => t.toMillis() >= cutoff24h
        );
        if (recentPhone.length >= PHONE_BOOKING_LIMIT_24H) {
          throw new Error("PHONE_LIMIT");
        }

        // 1b. Per-email 24h rate limit. Without this, an attacker could
        // bypass the per-phone cap by registering many disposable emails
        // with the same number. Counter doc id is a SHA-256 prefix of
        // the lower-cased email so plaintext addresses don't leak via
        // the counters collection if it's ever exposed.
        const emailCounterRef = adminDb.doc(EMAIL_COUNTER_DOC(data.email));
        const emailCounterSnap = await tx.get(emailCounterRef);
        const existingEmail: Timestamp[] = emailCounterSnap.exists
          ? (emailCounterSnap.data()?.bookings ?? [])
          : [];
        const recentEmail = existingEmail.filter(
          (t) => t.toMillis() >= cutoff24h
        );
        if (recentEmail.length >= EMAIL_BOOKING_LIMIT_24H) {
          throw new Error("EMAIL_LIMIT");
        }

        // 2. Global 1h rate limit
        const globalCounterRef = adminDb.doc(GLOBAL_COUNTER_DOC);
        const globalCounterSnap = await tx.get(globalCounterRef);
        const hKey = hourKey(now);
        const hourly: Record<string, number> = globalCounterSnap.exists
          ? (globalCounterSnap.data()?.hourly ?? {})
          : {};
        const currentHourCount = hourly[hKey] ?? 0;
        if (currentHourCount >= GLOBAL_BOOKING_LIMIT) {
          throw new Error("GLOBAL_LIMIT");
        }

        // 3. Slot overlap check (same date)
        const conflictsSnap = await tx.get(
          adminDb
            .collection("appointments")
            .where("barberId", "==", data.barberId)
            .where("startDateKey", "==", startKey)
        );
        // Match the slot-generator's blocking logic: each appointment
        // reserves [start, end + serviceBufferMinutes], and the new
        // appointment reserves [newStart, newEnd + newBuffer]. Without
        // including buffers here, a back-to-back booking that the slot
        // picker would have hidden could slip through if a stale slot
        // list is submitted from a client.
        const newEndWithBuffer = endTime.getTime() + buffer * 60_000;
        const overlap = conflictsSnap.docs.some((d) => {
          const a = d.data() as AppointmentDoc;
          if (a.status === "CANCELLED" || a.status === "NO_SHOW") return false;
          const aStart = a.startTime.toMillis();
          const aEndWithBuffer =
            a.endTime.toMillis() + (a.serviceBufferMinutes ?? 0) * 60_000;
          return (
            aStart < newEndWithBuffer &&
            aEndWithBuffer > startTime.getTime()
          );
        });
        if (overlap) throw new Error("SLOT_TAKEN");

        // === WRITES ===
        // 4. Customer upsert (in the same tx as appointment + counters
        // so a failed booking can't leave an orphan customer or phone
        // index, and so two concurrent bookings with the same phone
        // can't both fall into the "create" branch).
        const newSearchTokens = generateSearchTokens([
          data.firstName,
          data.lastName,
          phone,
          data.email,
        ]);
        if (existingCustomerId && existingCustomerSnap?.exists) {
          customerId = existingCustomerId;
          tx.update(adminDb.doc(`customers/${customerId}`), {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            emailSearch: data.email.toLowerCase(),
            searchTokens: newSearchTokens,
            updatedAt: nowTs,
          });
        } else {
          // Either no phone index, or the index points to a deleted
          // customer (data corruption — recreate). Both branches mint a
          // fresh customerId; create() on the index throws if it raced
          // with another writer, which fails the whole tx and prompts
          // the customer to retry rather than booking against an
          // incorrect customer.
          customerId = randomUUID();
          tx.create(adminDb.doc(`customers/${customerId}`), {
            id: customerId,
            firstName: data.firstName,
            lastName: data.lastName,
            phone,
            phoneSearch: phone.slice(-9),
            email: data.email,
            emailSearch: data.email.toLowerCase(),
            notes: null,
            visitCount: 0,
            searchTokens: newSearchTokens,
            createdAt: nowTs,
            updatedAt: nowTs,
          });
          if (existingCustomerId) {
            tx.set(phoneIdxRef, { customerId });
          } else {
            tx.create(phoneIdxRef, { customerId });
          }
        }

        // 5. Create appointment
        const apptRef = adminDb.doc(`appointments/${appointmentId}`);
        tx.create(
          apptRef,
          stripUndefined({
            id: appointmentId,
            barberId: data.barberId,
            customerId,
            serviceId: data.serviceId,
            barberName: `${barber.firstName} ${barber.lastName}`,
            serviceName: bs.serviceName,
            serviceBufferMinutes: buffer,
            customerName: `${data.firstName} ${data.lastName}`.trim(),
            customerPhone: phone,
            customerEmail: data.email,
            startTime: Timestamp.fromDate(startTime),
            endTime: Timestamp.fromDate(endTime),
            startDateKey: startKey,
            status: "CONFIRMED" as AppointmentStatus,
            priceExpectedCents: priceCents,
            priceFinalCents: null,
            cancellationTokenHash: tokenHash,
            // Plaintext fallback would defeat the purpose of hashing on
            // a DB leak. Lookup still works for new bookings via the
            // hashed field; legacy docs from the migration may still
            // carry a fallback, which getTokenLookupValues handles.
            cancellationTokenFallback: null,
            cancellationReason: null,
            notes: data.note || null,
            source: "online",
            reminderSentAt: null,
            confirmationEmailSentAt: null,
            confirmationEmailError: null,
            confirmationEmailAttempts: 0,
            cancellationEmailSentAt: null,
            cancellationEmailError: null,
            cancellationEmailAttempts: 0,
            telegramAlertSentAt: null,
            telegramAlertError: null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          })
        );

        const historyRef = apptRef.collection("history").doc();
        tx.create(historyRef, {
          id: historyRef.id,
          oldStatus: null,
          newStatus: "CONFIRMED",
          changedBy: "system",
          reason: null,
          changedAt: Timestamp.now(),
        });

        // 5. Update counters in the same transaction
        tx.set(phoneCounterRef, {
          bookings: [...recentPhone, nowTs],
        });
        tx.set(emailCounterRef, {
          bookings: [...recentEmail, nowTs],
        });

        const newHourly: Record<string, number> = { ...hourly };
        newHourly[hKey] = currentHourCount + 1;
        // GC older than 24h
        const cutoffHourKey = hourKey(subHours(now, 24));
        for (const k of Object.keys(newHourly)) {
          if (k < cutoffHourKey) delete newHourly[k];
        }
        tx.set(globalCounterRef, { hourly: newHourly });
      });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "PHONE_LIMIT") {
          return {
            success: false,
            field: "phone",
            error: `Pre toto telefónne číslo bol dosiahnutý denný limit rezervácií. Pre ďalšiu rezerváciu zavolajte na ${SHOP_PHONE_DISPLAY}.`,
          };
        }
        if (e.message === "EMAIL_LIMIT") {
          return {
            success: false,
            field: "email",
            error: `Pre tento email bol dosiahnutý denný limit rezervácií. Pre ďalšiu rezerváciu zavolajte na ${SHOP_PHONE_DISPLAY}.`,
          };
        }
        if (e.message === "GLOBAL_LIMIT") {
          return {
            success: false,
            error: "Príliš veľa rezervácií v krátkom čase. Skúste to o chvíľu.",
          };
        }
        if (e.message === "SLOT_TAKEN") {
          return {
            success: false,
            error: "Tento termín bol práve obsadený. Vyberte prosím iný čas.",
          };
        }
      }
      throw e;
    }

    // Customer-facing URL — always the canonical public domain, never the
    // staging `*.hosted.app` subdomain even when this booking was created
    // through a staging deploy. See PUBLIC_SITE_URL docstring.
    const cancelUrl = `${PUBLIC_SITE_URL}/cancel?token=${rawToken}`;
    const localStart = toZonedTime(startTime, TIMEZONE);
    const formattedDate = format(localStart, "d.M.yyyy");
    const formattedTime = format(localStart, "HH:mm");
    const barberName = `${barber.firstName} ${barber.lastName}`;

    // Email is the customer-facing confirmation — await it so a failed
    // SMTP returns to the booking response (handled below) rather than
    // a Cloud Run shutdown silently dropping the send.
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
      error: emailResult.success ? null : "send failed",
      durationMs: Date.now() - emailStart,
    });

    // Telegram is admin-only — fire-and-forget. The Cloud Run instance
    // stays alive for the rest of the response, which is enough for the
    // request to land at Telegram.
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

    if (!emailResult.success) {
      // Booking is committed in Firestore — surface the email failure to
      // the wizard so it can show a "your booking is confirmed but the
      // confirmation email didn't go through, please screenshot the
      // details" warning instead of silently pretending all is well.
      console.warn("[booking] email send failed for", appointmentId);
      return { success: true, appointmentId, emailFailed: true };
    }

    return { success: true, appointmentId };
  } catch (e) {
    console.error("[createBooking]", e);
    if (e instanceof Error && e.name === "ZodError") {
      return { success: false, error: "Neplatné údaje. Skontrolujte formulár." };
    }
    return { success: false, error: "Nastala neočakávaná chyba. Skúste to znova." };
  }
}

export async function cancelBooking(input: unknown): Promise<ActionResult> {
  try {
    const data = cancelBookingInputSchema.parse(input);
    const [primaryToken, fallbackToken] = getTokenLookupValues(data.token);
    const cancellationReason = data.reason || null;

    async function findByToken(
      field: "cancellationTokenHash" | "cancellationTokenFallback",
      val: string
    ): Promise<{ ref: FirebaseFirestore.DocumentReference; data: AppointmentDoc } | null> {
      const snap = await adminDb
        .collection("appointments")
        .where(field, "==", val)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { ref: doc.ref, data: doc.data() as AppointmentDoc };
    }

    let found = await findByToken("cancellationTokenHash", primaryToken);
    if (!found && fallbackToken) {
      found = await findByToken("cancellationTokenFallback", fallbackToken);
    }
    if (!found) {
      return { success: false, error: "Neplatný alebo expirovaný odkaz." };
    }

    const { ref, data: appointment } = found;

    // Re-read status + startTime INSIDE the transaction so a concurrent
    // admin status change (e.g. → IN_PROGRESS / COMPLETED) can't be
    // silently overwritten by a customer cancel that started its checks
    // a moment earlier. The pre-tx checks below still fast-path the
    // common case to avoid an unnecessary tx round-trip.
    if (!CANCELLABLE_STATUSES.includes(appointment.status)) {
      return { success: false, error: "Táto rezervácia už bola zrušená." };
    }

    const minCancelTime = addHours(new Date(), MIN_CANCEL_HOURS);
    if (isBefore(appointment.startTime.toDate(), minCancelTime)) {
      return {
        success: false,
        error: `Rezerváciu je možné zrušiť najneskôr ${MIN_CANCEL_HOURS} hodiny pred termínom.`,
      };
    }

    let oldStatus: AppointmentStatus = appointment.status;
    try {
      await adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists) throw new Error("NOT_FOUND");
        const current = fresh.data() as AppointmentDoc;

        if (!CANCELLABLE_STATUSES.includes(current.status)) {
          throw new Error("NOT_CANCELLABLE");
        }
        const freshMinCancelTime = addHours(new Date(), MIN_CANCEL_HOURS);
        if (isBefore(current.startTime.toDate(), freshMinCancelTime)) {
          throw new Error("TOO_LATE");
        }
        oldStatus = current.status;

        tx.update(ref, {
          status: "CANCELLED",
          cancellationReason,
          updatedAt: Timestamp.now(),
        });

        const historyRef = ref.collection("history").doc();
        tx.create(historyRef, {
          id: historyRef.id,
          oldStatus: current.status,
          newStatus: "CANCELLED",
          changedBy: "customer",
          reason: cancellationReason
            ? `Zrušené zákazníkom: ${cancellationReason}`
            : "Zrušené zákazníkom",
          changedAt: Timestamp.now(),
        });
      });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "NOT_FOUND") {
          return { success: false, error: "Neplatný alebo expirovaný odkaz." };
        }
        if (e.message === "NOT_CANCELLABLE") {
          return {
            success: false,
            error: "Túto rezerváciu už nie je možné zrušiť.",
          };
        }
        if (e.message === "TOO_LATE") {
          return {
            success: false,
            error: `Rezerváciu je možné zrušiť najneskôr ${MIN_CANCEL_HOURS} hodiny pred termínom.`,
          };
        }
      }
      throw e;
    }
    void oldStatus;

    const localCancelStart = toZonedTime(
      appointment.startTime.toDate(),
      TIMEZONE
    );
    const notifications: Promise<unknown>[] = [];

    if (appointment.customerEmail) {
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
        }).catch((err) => console.error("[EMAIL]", err))
      );
    }

    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      const formattedDate = format(localCancelStart, "d.M.yyyy");
      const formattedTime = format(localCancelStart, "HH:mm");
      const safeCustomerName = escapeTelegramHtml(
        appointment.customerName || "neznámy"
      );
      const safeServiceName = escapeTelegramHtml(appointment.serviceName);
      const safePhone = appointment.customerPhone
        ? escapeTelegramHtml(appointment.customerPhone)
        : null;
      const safeReason = cancellationReason
        ? escapeTelegramHtml(cancellationReason)
        : null;

      notifications.push(
        sendTelegramNotification({
          chatId,
          message:
            `<b>Zrušená rezervácia</b>\n` +
            `Zákazník: ${safeCustomerName}\n` +
            `Služba: ${safeServiceName}\n` +
            `Dátum: ${escapeTelegramHtml(formattedDate)} o ${escapeTelegramHtml(formattedTime)}` +
            `${safePhone ? `\nTel: ${safePhone}` : ""}` +
            `${safeReason ? `\nDôvod: ${safeReason}` : ""}`,
        }).catch((err) => console.error("[TELEGRAM]", err))
      );
    }

    await Promise.all(notifications);

    return { success: true };
  } catch (e) {
    console.error("[cancelBooking]", e);
    if (e instanceof Error && e.name === "ZodError") {
      return { success: false, error: "Skontrolujte odkaz alebo dôvod zrušenia." };
    }
    return { success: false, error: "Nastala neočakávaná chyba. Skúste to znova." };
  }
}
