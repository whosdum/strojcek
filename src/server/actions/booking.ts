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
} from "@/lib/constants";
import { SHOP_PHONE_DISPLAY } from "@/lib/business-info";
import type { AppointmentStatus } from "@/lib/types";
import type {
  AppointmentDoc,
  BarberDoc,
  BarberServiceDoc,
} from "@/server/types/firestore";

type ActionResult = { success: boolean; error?: string; appointmentId?: string };

const PHONE_COUNTER_DOC = (phone: string) => `counters/phone_${phone}`;
const GLOBAL_COUNTER_DOC = "counters/global_bookings";

export async function createBooking(input: unknown): Promise<ActionResult> {
  try {
    const data = bookingInputSchema.parse(input);
    const phone = normalizePhone(data.phone);

    // Pre-load barber + barber-service (outside the transaction; not race-sensitive)
    const [barberSnap, bsSnap] = await Promise.all([
      adminDb.doc(`barbers/${data.barberId}`).get(),
      adminDb.doc(`barbers/${data.barberId}/services/${data.serviceId}`).get(),
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

    // Customer upsert is intentionally OUTSIDE the booking transaction
    // (cross-collection get-or-create is hard to do atomically and not race-sensitive
    // for booking — duplicate customer rows are not the failure mode we care about).
    const phoneIdxRef = adminDb.doc(`customerPhones/${phone}`);
    const idxSnap = await phoneIdxRef.get();
    let customerId: string;

    if (idxSnap.exists) {
      customerId = (idxSnap.data() as { customerId: string }).customerId;
      await adminDb.doc(`customers/${customerId}`).update({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        emailSearch: data.email.toLowerCase(),
        searchTokens: generateSearchTokens([
          data.firstName,
          data.lastName,
          phone,
          data.email,
        ]),
        updatedAt: Timestamp.now(),
      });
    } else {
      customerId = randomUUID();
      const batch = adminDb.batch();
      batch.create(adminDb.doc(`customers/${customerId}`), {
        id: customerId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone,
        phoneSearch: phone.slice(-9),
        email: data.email,
        emailSearch: data.email.toLowerCase(),
        notes: null,
        visitCount: 0,
        searchTokens: generateSearchTokens([
          data.firstName,
          data.lastName,
          phone,
          data.email,
        ]),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      batch.create(phoneIdxRef, { customerId });
      await batch.commit();
    }

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const appointmentId = randomUUID();

    // === Atomic transaction: rate limits + slot conflict + create + counters ===
    try {
      await adminDb.runTransaction(async (tx) => {
        const now = new Date();
        const nowTs = Timestamp.fromDate(now);

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

        // 4. Create appointment
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
            error: `Dosiahli ste maximálny počet rezervácií za 24 hodín. Pre ďalšiu rezerváciu zavolajte na ${SHOP_PHONE_DISPLAY}.`,
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cancelUrl = `${appUrl}/cancel?token=${rawToken}`;
    const localStart = toZonedTime(startTime, TIMEZONE);
    const formattedDate = format(localStart, "d.M.yyyy");
    const formattedTime = format(localStart, "HH:mm");
    const barberName = `${barber.firstName} ${barber.lastName}`;

    // Email is the customer-facing confirmation — await it so a failed
    // SMTP returns to the booking response (handled below) rather than
    // a Cloud Run shutdown silently dropping the send.
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
      return { success: false } as const;
    });

    // Telegram is admin-only — fire-and-forget. The Cloud Run instance
    // stays alive for the rest of the response, which is enough for the
    // request to land at Telegram.
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      sendTelegramNotification({
        chatId,
        message:
          `<b>Nová rezervácia</b>\n` +
          `Zákazník: ${escapeTelegramHtml(`${data.firstName} ${data.lastName}`)}\n` +
          `Služba: ${escapeTelegramHtml(bs.serviceName)}\n` +
          `Dátum: ${escapeTelegramHtml(formattedDate)} o ${escapeTelegramHtml(formattedTime)}\n` +
          `Tel: ${escapeTelegramHtml(phone)}\n` +
          `Email: ${escapeTelegramHtml(data.email)}`,
      }).catch((err) => console.error("[booking][telegram]", err));
    }

    if (!emailResult.success) {
      // Booking is committed in Firestore. Tell the customer it succeeded
      // but warn that the email may not arrive — better than pretending
      // success when SMTP is misconfigured.
      console.warn("[booking] email send failed for", appointmentId);
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

    await adminDb.runTransaction(async (tx) => {
      tx.update(ref, {
        status: "CANCELLED",
        cancellationReason,
        updatedAt: Timestamp.now(),
      });

      const historyRef = ref.collection("history").doc();
      tx.create(historyRef, {
        id: historyRef.id,
        oldStatus: appointment.status,
        newStatus: "CANCELLED",
        changedBy: "customer",
        reason: cancellationReason
          ? `Zrušené zákazníkom: ${cancellationReason}`
          : "Zrušené zákazníkom",
        changedAt: Timestamp.now(),
      });
    });

    const localCancelStart = toZonedTime(
      appointment.startTime.toDate(),
      TIMEZONE
    );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
            bookUrl: appUrl,
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
