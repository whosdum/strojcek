"use server";

import { revalidatePath } from "next/cache";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { addMinutes, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { randomUUID } from "crypto";

import { adminDb } from "@/server/lib/firebase-admin";
import { PUBLIC_SITE_URL } from "@/lib/business-info";
import {
  dateKey,
  generateSearchTokens,
  stripUndefined,
} from "@/server/lib/firestore-utils";
import { getSession } from "@/server/lib/auth";
import { TIMEZONE, VALID_STATUS_TRANSITIONS } from "@/lib/constants";
import {
  adminAppointmentInputSchema,
  adminAppointmentEditSchema,
} from "@/lib/validators";
import { normalizePhone } from "@/server/lib/phone";
import { generateToken, hashToken } from "@/server/lib/tokens";
import { sendEmail } from "@/server/lib/email";
import {
  escapeTelegramHtml,
  sendTelegramNotification,
} from "@/server/lib/telegram";
import { bookingConfirmationHtml } from "@/emails/booking-confirmation";
import { bookingCancellationHtml } from "@/emails/booking-cancellation";
import { recordNotification } from "@/server/lib/notification-log";
import { format as formatDate } from "date-fns";
import type { AppointmentStatus } from "@/lib/types";
import type {
  AppointmentDoc,
  BarberDoc,
  BarberServiceDoc,
} from "@/server/types/firestore";

type ActionResult = { success: boolean; error?: string; appointmentId?: string };

const UNAUTH: ActionResult = {
  success: false,
  error: "Neautorizovaný prístup.",
};

interface CustomerUpsertResult {
  customerId: string;
}

/**
 * Bratislava-local "today" key (YYYY-MM-DD). Used to reject admin
 * appointments dated in the past unless the admin explicitly opts in via
 * `ignoreSchedule`. Local TZ avoids the late-night UTC drift bug where the
 * server thought "today" was still yesterday's date until 02:00 CEST.
 */
function todayLocalKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

async function upsertCustomerByPhone(input: {
  phone: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
}): Promise<CustomerUpsertResult> {
  const { phone, firstName, lastName, email } = input;
  const phoneIdxRef = adminDb.doc(`customerPhones/${phone}`);
  const idxSnap = await phoneIdxRef.get();

  if (idxSnap.exists) {
    const customerId = (idxSnap.data() as { customerId: string }).customerId;
    // Re-read the existing customer so we can preserve PII the admin
    // didn't re-type. A blank field in the form means "I'm not editing
    // this", not "wipe it" — admin creating a follow-up appointment
    // for a returning customer must not destroy their email/lastName
    // just because those fields weren't refilled.
    const existingSnap = await adminDb.doc(`customers/${customerId}`).get();
    const existing = existingSnap.exists
      ? (existingSnap.data() as {
          firstName?: string;
          lastName?: string | null;
          email?: string | null;
        })
      : {};

    const finalFirstName = firstName.trim() || existing.firstName || firstName;
    const finalLastName =
      lastName && lastName.trim().length > 0
        ? lastName
        : (existing.lastName ?? null);
    const finalEmail =
      email && email.trim().length > 0 ? email : (existing.email ?? null);

    await adminDb.doc(`customers/${customerId}`).update({
      firstName: finalFirstName,
      lastName: finalLastName,
      email: finalEmail,
      emailSearch: finalEmail ? finalEmail.toLowerCase() : null,
      searchTokens: generateSearchTokens([
        finalFirstName,
        finalLastName,
        phone,
        finalEmail,
      ]),
      updatedAt: Timestamp.now(),
    });
    return { customerId };
  }

  const customerId = randomUUID();
  const batch = adminDb.batch();
  batch.create(adminDb.doc(`customers/${customerId}`), {
    id: customerId,
    firstName,
    lastName: lastName ?? null,
    phone,
    phoneSearch: phone.slice(-9),
    email: email ?? null,
    emailSearch: email ? email.toLowerCase() : null,
    notes: null,
    visitCount: 0,
    searchTokens: generateSearchTokens([firstName, lastName, phone, email]),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  batch.create(phoneIdxRef, { customerId });
  await batch.commit();
  return { customerId };
}

async function loadBarberAndService(
  barberId: string,
  serviceId: string
): Promise<{
  barber: BarberDoc & { id: string };
  bs: BarberServiceDoc;
} | null> {
  const [barberSnap, bsSnap] = await Promise.all([
    adminDb.doc(`barbers/${barberId}`).get(),
    adminDb.doc(`barbers/${barberId}/services/${serviceId}`).get(),
  ]);
  if (!barberSnap.exists || !bsSnap.exists) return null;
  return {
    barber: { ...(barberSnap.data() as BarberDoc), id: barberSnap.id },
    bs: bsSnap.data() as BarberServiceDoc,
  };
}

export async function updateAppointmentStatus(
  id: string,
  newStatus: AppointmentStatus,
  reason?: string
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const apptRef = adminDb.doc(`appointments/${id}`);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(apptRef);
      if (!snap.exists) return { kind: "not_found" as const };
      const current = snap.data() as AppointmentDoc;

      if (current.status === newStatus) return { kind: "noop" as const };

      const allowed = VALID_STATUS_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(newStatus)) {
        return { kind: "invalid" as const, from: current.status };
      }

      tx.update(apptRef, {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      const historyRef = apptRef.collection("history").doc();
      tx.create(historyRef, {
        id: historyRef.id,
        oldStatus: current.status,
        newStatus,
        changedBy: "admin",
        reason: reason ?? null,
        changedAt: Timestamp.now(),
        expireAt: Timestamp.fromMillis(
          Timestamp.now().toMillis() + 365 * 24 * 60 * 60 * 1000
        ),
      });

      if (current.customerId) {
        const customerRef = adminDb.doc(`customers/${current.customerId}`);
        if (newStatus === "COMPLETED" && current.status !== "COMPLETED") {
          tx.update(customerRef, { visitCount: FieldValue.increment(1) });
        } else if (current.status === "COMPLETED" && newStatus !== "COMPLETED") {
          tx.update(customerRef, { visitCount: FieldValue.increment(-1) });
        }
      }
      return { kind: "ok" as const, prev: current };
    });

    if (result.kind === "not_found") {
      return { success: false, error: "Rezervácia nenájdená." };
    }
    if (result.kind === "invalid") {
      return {
        success: false,
        error: `Nie je možné zmeniť stav z "${result.from}" na "${newStatus}".`,
      };
    }

    // Notify on admin-driven status changes that the customer needs to know
    // about. We do this AFTER the transaction so a failed email doesn't roll
    // back the status update.
    if (result.kind === "ok") {
      const localStart = toZonedTime(result.prev.startTime.toDate(), TIMEZONE);
      const dateStr = formatDate(localStart, "d.M.yyyy");
      const timeStr = formatDate(localStart, "HH:mm");

      // Customer email when admin cancels.
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

      // Telegram audit ping for the admin's records on every transition.
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
    }

    return { success: true };
  } catch (e) {
    console.error("[updateAppointmentStatus]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii." };
  }
}

export async function createAppointmentAdmin(
  input: unknown
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const data = adminAppointmentInputSchema.parse(input);

    // Admins shouldn't be able to backdate brand-new bookings into the
    // past — that confuses reports, slot logic and customer comms. The
    // `ignoreSchedule` toggle stays as the explicit escape hatch for
    // legitimate cases (e.g. recording a walk-in that happened earlier
    // today, or correcting a missed entry from yesterday).
    if (!data.ignoreSchedule && data.date < todayLocalKey()) {
      return {
        success: false,
        error:
          "Dátum nesmie byť v minulosti. Pre historické záznamy zapnite „Ignorovať rozvrh“.",
      };
    }

    const loaded = await loadBarberAndService(data.barberId, data.serviceId);
    if (!loaded) {
      return { success: false, error: "Barber neponúka túto službu." };
    }
    const { barber, bs } = loaded;

    // Walk-in mode supports a duration override so admin can block any
    // length of time (e.g. 3h 30min = 210) without having to pick a
    // service that happens to match. Buffer is also zeroed for
    // walk-ins — there's no service-level transition to honour for a
    // self-imposed block.
    const customDuration =
      data.walkIn &&
      typeof data.customDurationMinutes === "number" &&
      data.customDurationMinutes > 0
        ? data.customDurationMinutes
        : null;
    const duration = customDuration ?? bs.customDuration ?? bs.defaultDuration;
    const buffer = data.walkIn ? 0 : bs.bufferMinutes;
    const priceCents = data.walkIn
      ? 0
      : (bs.customPriceCents ?? bs.defaultPriceCents);

    const startTime = fromZonedTime(`${data.date}T${data.time}:00`, TIMEZONE);
    const endTime = addMinutes(startTime, duration);
    const startKey = dateKey(startTime);

    // Walk-in / blocked-time: no customer record, no notifications, no
    // cancellation token (there's no one to send the link to). Customer
    // upsert and email send are skipped entirely.
    let customerId: string | null = null;
    let phone: string | null = null;
    let customerEmail: string | null = null;
    let customerName: string;

    if (data.walkIn) {
      customerName = data.label?.trim() || "Walk-in";
    } else {
      phone = normalizePhone(data.phone);
      customerEmail = data.email || null;
      const upserted = await upsertCustomerByPhone({
        phone,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: customerEmail,
      });
      customerId = upserted.customerId;
      customerName = `${data.firstName} ${data.lastName || ""}`.trim();
    }

    const rawToken = data.walkIn ? null : generateToken();
    const tokenHash = rawToken ? hashToken(rawToken) : null;
    const appointmentId = randomUUID();

    try {
      await adminDb.runTransaction(async (tx) => {
        if (!data.ignoreSchedule) {
          // Match the public booking action: query by (barberId,
          // startDateKey) so cross-midnight long bookings can't slip
          // past the previous startTime-range filter, and include
          // service buffers on both sides of the comparison so a new
          // appointment can't eat the buffer of an adjacent one.
          const overlapping = await tx.get(
            adminDb
              .collection("appointments")
              .where("barberId", "==", data.barberId)
              .where("startDateKey", "==", startKey)
          );
          const newEndWithBuffer = endTime.getTime() + buffer * 60_000;
          const conflict = overlapping.docs.some((d) => {
            const a = d.data() as AppointmentDoc;
            if (a.status === "CANCELLED" || a.status === "NO_SHOW") return false;
            const aStart = a.startTime.toMillis();
            const aEndWithBuffer =
              a.endTime.toMillis() + (a.serviceBufferMinutes ?? 0) * 60_000;
            return (
              aStart < newEndWithBuffer && aEndWithBuffer > startTime.getTime()
            );
          });
          if (conflict) throw new Error("SLOT_TAKEN");
        }

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
            customerName,
            customerPhone: phone,
            customerEmail,
            startTime: Timestamp.fromDate(startTime),
            endTime: Timestamp.fromDate(endTime),
            startDateKey: startKey,
            status: "CONFIRMED" as AppointmentStatus,
            priceExpectedCents: priceCents,
            priceFinalCents: null,
            cancellationTokenHash: tokenHash,
            // No plaintext fallback on new bookings — see booking.ts.
            cancellationTokenFallback: null,
            cancellationReason: null,
            notes: data.notes || null,
            source: data.walkIn ? "walk-in" : "admin",
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
          changedBy: "admin",
          reason: null,
          changedAt: Timestamp.now(),
          expireAt: Timestamp.fromMillis(
            Timestamp.now().toMillis() + 365 * 24 * 60 * 60 * 1000
          ),
        });
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "SLOT_TAKEN") {
        return {
          success: false,
          error:
            "Tento termín je obsadený. Zapnite „Ignorovať rozvrh“ alebo zvoľte iný čas.",
        };
      }
      throw e;
    }

    // Walk-in / blocked-time entries don't notify anyone — there's no
    // customer email, no rawToken (cancel link), and no SMS phone.
    // The booking is committed; the operator can see it on the calendar.
    if (!data.walkIn) {
      const localStart = toZonedTime(startTime, TIMEZONE);
      const formattedDate = format(localStart, "d.M.yyyy");
      const formattedTime = format(localStart, "HH:mm");
      const barberName = `${barber.firstName} ${barber.lastName}`;

      if (customerEmail && rawToken) {
        // Customer-facing URL — pin to the canonical public domain so
        // the cancel link in the email never points at the staging
        // `*.hosted.app` host even when triggered from a staging deploy.
        const cancelUrl = `${PUBLIC_SITE_URL}/cancel?token=${rawToken}`;

        // Await the customer-facing confirmation email so a misconfigured
        // SMTP surfaces as a real failure path rather than disappearing
        // when Cloud Run shuts down the response.
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
          console.error("[createAppointmentAdmin][email]", err);
          return { success: false } as const;
        });
        await recordNotification({
          kind: "email-confirmation",
          status: emailResult.success ? "sent" : "failed",
          appointmentId,
          recipient: customerEmail,
          error: emailResult.success ? null : "send failed",
          durationMs: Date.now() - emailStart,
        });
      }

      // Mirror booking.ts: fire-and-forget Telegram alert to the admin
      // chat. Independent of the email path so a missing customer email
      // (admin-created walk-in-style entry that still has a phone) doesn't
      // suppress the operator notification.
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        const tgStart = Date.now();
        sendTelegramNotification({
          chatId,
          message:
            `<b>Nová rezervácia (admin)</b>\n` +
            `Zákazník: ${escapeTelegramHtml(customerName)}\n` +
            `Služba: ${escapeTelegramHtml(bs.serviceName)}\n` +
            `Dátum: ${escapeTelegramHtml(formattedDate)} o ${escapeTelegramHtml(formattedTime)}\n` +
            (phone ? `Tel: ${escapeTelegramHtml(phone)}\n` : "") +
            (customerEmail ? `Email: ${escapeTelegramHtml(customerEmail)}` : ""),
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
            console.error("[createAppointmentAdmin][telegram]", err);
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
    }

    revalidatePath("/admin/reservations");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin");

    return { success: true, appointmentId };
  } catch (e) {
    console.error("[createAppointmentAdmin]", e);
    if (e instanceof Error && e.name === "ZodError") {
      return { success: false, error: "Skontrolujte údaje vo formulári." };
    }
    return { success: false, error: "Nastala chyba pri vytváraní rezervácie." };
  }
}

export async function updateAppointment(
  id: string,
  input: unknown
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const apptRef = adminDb.doc(`appointments/${id}`);
    const existingSnap = await apptRef.get();
    if (!existingSnap.exists) {
      return { success: false, error: "Rezervácia nenájdená." };
    }
    const existing = existingSnap.data() as AppointmentDoc;

    if (existing.status === "CANCELLED" || existing.status === "NO_SHOW") {
      return { success: false, error: "Túto rezerváciu už nie je možné upraviť." };
    }

    const data = adminAppointmentEditSchema.parse(input);
    const limited =
      existing.status === "IN_PROGRESS" || existing.status === "COMPLETED";

    // Block moving an appointment INTO the past unless the admin opts in
    // via `ignoreSchedule`. We compare the new date against the existing
    // startDateKey so editing notes/price on a historical record (where
    // both the old and new date are already in the past) keeps working.
    if (
      !limited &&
      !data.ignoreSchedule &&
      data.date < todayLocalKey() &&
      data.date !== existing.startDateKey
    ) {
      return {
        success: false,
        error:
          "Dátum nesmie byť v minulosti. Pre historické záznamy zapnite „Ignorovať rozvrh“.",
      };
    }

    if (limited) {
      const priceFinal =
        data.priceFinal === "" || data.priceFinal == null
          ? null
          : Math.round(Number(data.priceFinal) * 100);

      const changedFields: string[] = [];
      if ((existing.notes ?? null) !== (data.notes || null)) changedFields.push("notes");
      if ((existing.priceFinalCents ?? null) !== priceFinal) changedFields.push("priceFinalCents");

      const batch = adminDb.batch();
      batch.update(apptRef, {
        notes: data.notes || null,
        priceFinalCents: priceFinal,
        updatedAt: Timestamp.now(),
      });
      if (changedFields.length > 0) {
        const historyRef = apptRef.collection("history").doc();
        batch.create(historyRef, {
          id: historyRef.id,
          oldStatus: existing.status,
          newStatus: existing.status,
          changedBy: "admin",
          reason: `Upravené polia: ${changedFields.join(", ")}`,
          changedAt: Timestamp.now(),
          expireAt: Timestamp.fromMillis(
            Timestamp.now().toMillis() + 365 * 24 * 60 * 60 * 1000
          ),
        });
      }
      await batch.commit();
    } else {
      // Walk-in mode is sticky — once an appointment is created without
      // a customer, the form sends back walkIn=true on every save and
      // we never invent a customer record on edit. Prevents accidental
      // role flip when admin edits a walk-in to add a label.
      const isWalkIn = data.walkIn || existing.source === "walk-in";

      const loaded = await loadBarberAndService(data.barberId, data.serviceId);
      if (!loaded) {
        return { success: false, error: "Barber neponúka túto službu." };
      }
      const { barber, bs } = loaded;

      // Same walk-in duration override + buffer/price zeroing as in
      // createAppointmentAdmin. Sticky walk-in mode means re-saves
      // honour customDurationMinutes if admin tweaks the block length.
      const customDuration =
        isWalkIn &&
        typeof data.customDurationMinutes === "number" &&
        data.customDurationMinutes > 0
          ? data.customDurationMinutes
          : null;
      const duration =
        customDuration ?? bs.customDuration ?? bs.defaultDuration;
      const buffer = isWalkIn ? 0 : bs.bufferMinutes;
      const priceCents = isWalkIn
        ? 0
        : (bs.customPriceCents ?? bs.defaultPriceCents);

      const startTime = fromZonedTime(`${data.date}T${data.time}:00`, TIMEZONE);
      const endTime = addMinutes(startTime, duration);
      const startKey = dateKey(startTime);

      let customerId: string | null = null;
      let phone: string | null = null;
      let customerEmail: string | null = null;
      let customerName: string;

      if (isWalkIn) {
        customerName = data.label?.trim() || existing.customerName || "Walk-in";
      } else {
        phone = normalizePhone(data.phone);
        customerEmail = data.email || null;
        const upserted = await upsertCustomerByPhone({
          phone,
          firstName: data.firstName,
          lastName: data.lastName || null,
          email: customerEmail,
        });
        customerId = upserted.customerId;
        customerName = `${data.firstName} ${data.lastName || ""}`.trim();
      }

      const priceFinal =
        data.priceFinal === "" || data.priceFinal == null
          ? null
          : Math.round(Number(data.priceFinal) * 100);

      try {
        await adminDb.runTransaction(async (tx) => {
          if (!data.ignoreSchedule) {
            const overlapping = await tx.get(
              adminDb
                .collection("appointments")
                .where("barberId", "==", data.barberId)
                .where("startDateKey", "==", startKey)
            );
            // Buffered comparison — match the public booking path so an
            // admin re-time can't pretend the next service has zero
            // transition time.
            const newEndWithBuffer = endTime.getTime() + buffer * 60_000;
            const conflict = overlapping.docs.some((d) => {
              if (d.id === id) return false;
              const a = d.data() as AppointmentDoc;
              if (a.status === "CANCELLED" || a.status === "NO_SHOW") return false;
              const aStart = a.startTime.toMillis();
              const aEndWithBuffer =
                a.endTime.toMillis() + (a.serviceBufferMinutes ?? 0) * 60_000;
              return (
                aStart < newEndWithBuffer && aEndWithBuffer > startTime.getTime()
              );
            });
            if (conflict) throw new Error("SLOT_TAKEN");
          }

          tx.update(
            apptRef,
            stripUndefined({
              barberId: data.barberId,
              serviceId: data.serviceId,
              customerId,
              barberName: `${barber.firstName} ${barber.lastName}`,
              serviceName: bs.serviceName,
              serviceBufferMinutes: buffer,
              startTime: Timestamp.fromDate(startTime),
              endTime: Timestamp.fromDate(endTime),
              startDateKey: startKey,
              priceExpectedCents: priceCents,
              priceFinalCents: priceFinal,
              customerName,
              customerPhone: phone,
              customerEmail,
              notes: data.notes || null,
              updatedAt: Timestamp.now(),
            })
          );

          // Audit trail for field-level edits. Status stays the same on
          // an edit (status changes flow through updateAppointmentStatus),
          // so we record old=new and stash the changed-field list in the
          // reason string so the admin can see what was touched.
          const changedFields: string[] = [];
          if (existing.barberId !== data.barberId) changedFields.push("barberId");
          if (existing.serviceId !== data.serviceId) changedFields.push("serviceId");
          if (existing.startTime.toMillis() !== startTime.getTime()) changedFields.push("startTime");
          if (existing.priceExpectedCents !== priceCents) changedFields.push("priceExpectedCents");
          if ((existing.priceFinalCents ?? null) !== priceFinal) changedFields.push("priceFinalCents");
          if ((existing.customerPhone ?? null) !== phone) changedFields.push("customerPhone");
          if ((existing.customerEmail ?? null) !== customerEmail) changedFields.push("customerEmail");
          if ((existing.customerName ?? null) !== customerName) changedFields.push("customerName");
          if ((existing.notes ?? null) !== (data.notes || null)) changedFields.push("notes");

          if (changedFields.length > 0) {
            const historyRef = apptRef.collection("history").doc();
            tx.create(historyRef, {
              id: historyRef.id,
              oldStatus: existing.status,
              newStatus: existing.status,
              changedBy: "admin",
              reason: `Upravené polia: ${changedFields.join(", ")}`,
              changedAt: Timestamp.now(),
              expireAt: Timestamp.fromMillis(
                Timestamp.now().toMillis() + 365 * 24 * 60 * 60 * 1000
              ),
            });
          }
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "SLOT_TAKEN") {
          return {
            success: false,
            error:
              "Tento termín je obsadený. Zapnite „Ignorovať rozvrh“ alebo zvoľte iný čas.",
          };
        }
        throw e;
      }
    }

    revalidatePath(`/admin/reservations/${id}`);
    revalidatePath("/admin/reservations");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin");

    return { success: true, appointmentId: id };
  } catch (e) {
    console.error("[updateAppointment]", e);
    if (e instanceof Error && e.name === "ZodError") {
      return { success: false, error: "Skontrolujte údaje vo formulári." };
    }
    return { success: false, error: "Nastala chyba pri aktualizácii rezervácie." };
  }
}

const TERMINAL_STATUSES: AppointmentStatus[] = [
  "CANCELLED",
  "NO_SHOW",
  "COMPLETED",
];

export async function deleteAppointment(id: string): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const apptRef = adminDb.doc(`appointments/${id}`);

    // One transaction across read → visitCount decrement → history wipe →
    // appointment delete. Previously these were two separate writes, which
    // could leave visitCount inconsistent with the actual appointment count
    // if the network failed between the increment call and the batch.
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(apptRef);
      if (!snap.exists) {
        throw new Error("NOT_FOUND");
      }
      const data = snap.data() as AppointmentDoc;

      // Refuse to hard-delete an active reservation that has a real
      // customer attached. The customer would just show up to a slot
      // that no longer exists, with no notification, and no record we
      // could investigate when they call to ask. Force the admin to go
      // through CANCELLED first (which sends the cancellation email
      // and writes a status-change history entry); after that, this
      // delete works because the status is terminal.
      //
      // Walk-ins / blocked-time entries (no customer contact) bypass
      // this rule — there's no one to notify and the audit trail risk
      // is minimal.
      const isTerminal = TERMINAL_STATUSES.includes(data.status);
      const hasCustomerContact = !!(data.customerEmail || data.customerPhone);
      if (!isTerminal && hasCustomerContact) {
        throw new Error("NOT_TERMINAL");
      }

      const historySnap = await tx.get(apptRef.collection("history"));

      if (data.status === "COMPLETED" && data.customerId) {
        tx.update(adminDb.doc(`customers/${data.customerId}`), {
          visitCount: FieldValue.increment(-1),
        });
      }
      for (const h of historySnap.docs) tx.delete(h.ref);
      tx.delete(apptRef);
    });

    revalidatePath("/admin/reservations");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return { success: false, error: "Rezervácia nenájdená." };
    }
    if (e instanceof Error && e.message === "NOT_TERMINAL") {
      return {
        success: false,
        error:
          "Aktívnu rezerváciu so zákazníckymi kontaktmi nemožno mazať priamo. Najprv ju zrušte (Status → Zrušená), aby zákazník dostal notifikáciu, potom môžete záznam zmazať.",
      };
    }
    console.error("[deleteAppointment]", e);
    return { success: false, error: "Nastala chyba pri mazaní rezervácie." };
  }
}
