"use server";

import { revalidatePath } from "next/cache";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { addMinutes, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { randomUUID } from "crypto";

import { adminDb } from "@/server/lib/firebase-admin";
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
    await adminDb.doc(`customers/${customerId}`).update({
      firstName,
      lastName: lastName ?? null,
      email: email ?? null,
      emailSearch: email ? email.toLowerCase() : null,
      searchTokens: generateSearchTokens([firstName, lastName, phone, email]),
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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const localStart = toZonedTime(result.prev.startTime.toDate(), TIMEZONE);
      const dateStr = formatDate(localStart, "d.M.yyyy");
      const timeStr = formatDate(localStart, "HH:mm");

      // Customer email when admin cancels.
      if (
        newStatus === "CANCELLED" &&
        result.prev.status !== "CANCELLED" &&
        result.prev.customerEmail
      ) {
        sendEmail({
          to: result.prev.customerEmail,
          subject: "Vaša rezervácia bola zrušená — Strojček",
          html: bookingCancellationHtml({
            customerName: result.prev.customerName || "zákazník",
            serviceName: result.prev.serviceName,
            barberName: result.prev.barberName,
            date: dateStr,
            time: timeStr,
            bookUrl: appUrl,
          }),
        }).catch((err) =>
          console.error("[updateAppointmentStatus][email]", err)
        );
      }

      // Telegram audit ping for the admin's records on every transition.
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
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
        }).catch((err) =>
          console.error("[updateAppointmentStatus][telegram]", err)
        );
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

    const phone = normalizePhone(data.phone);

    const loaded = await loadBarberAndService(data.barberId, data.serviceId);
    if (!loaded) {
      return { success: false, error: "Barber neponúka túto službu." };
    }
    const { barber, bs } = loaded;

    const duration = bs.customDuration ?? bs.defaultDuration;
    const buffer = bs.bufferMinutes;
    const priceCents = bs.customPriceCents ?? bs.defaultPriceCents;

    const startTime = fromZonedTime(`${data.date}T${data.time}:00`, TIMEZONE);
    const endTime = addMinutes(startTime, duration);
    const startKey = dateKey(startTime);

    const { customerId } = await upsertCustomerByPhone({
      phone,
      firstName: data.firstName,
      lastName: data.lastName || null,
      email: data.email,
    });

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const appointmentId = randomUUID();

    try {
      await adminDb.runTransaction(async (tx) => {
        if (!data.ignoreSchedule) {
          const startTs = Timestamp.fromDate(startTime);
          const endTs = Timestamp.fromDate(endTime);
          const overlapping = await tx.get(
            adminDb
              .collection("appointments")
              .where("barberId", "==", data.barberId)
              .where("startTime", "<", endTs)
              .where("startTime", ">=", Timestamp.fromMillis(
                startTs.toMillis() - 24 * 60 * 60 * 1000
              ))
          );
          const conflict = overlapping.docs.some((d) => {
            const a = d.data() as AppointmentDoc;
            if (a.status === "CANCELLED" || a.status === "NO_SHOW") return false;
            const aStart = a.startTime.toMillis();
            const aEnd = a.endTime.toMillis();
            return aStart < endTime.getTime() && aEnd > startTime.getTime();
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
            customerName: `${data.firstName} ${data.lastName || ""}`.trim(),
            customerPhone: phone,
            customerEmail: data.email,
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
            source: "admin",
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
          changedBy: "admin",
          reason: null,
          changedAt: Timestamp.now(),
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cancelUrl = `${appUrl}/cancel?token=${rawToken}`;
    const localStart = toZonedTime(startTime, TIMEZONE);

    // Await the customer-facing confirmation email so a misconfigured
    // SMTP surfaces as a real failure path rather than disappearing
    // when Cloud Run shuts down the response.
    await sendEmail({
      to: data.email,
      subject: "Potvrdenie rezervácie - Strojček",
      html: bookingConfirmationHtml({
        customerName: data.firstName,
        serviceName: bs.serviceName,
        barberName: `${barber.firstName} ${barber.lastName}`,
        date: format(localStart, "d.M.yyyy"),
        time: format(localStart, "HH:mm"),
        price: (priceCents / 100).toString(),
        cancelUrl,
        startTimeUtc: startTime.toISOString(),
        endTimeUtc: endTime.toISOString(),
      }),
    }).catch((err) => console.error("[createAppointmentAdmin][email]", err));

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

      await apptRef.update({
        notes: data.notes || null,
        priceFinalCents: priceFinal,
        updatedAt: Timestamp.now(),
      });
    } else {
      const phone = normalizePhone(data.phone);
      const loaded = await loadBarberAndService(data.barberId, data.serviceId);
      if (!loaded) {
        return { success: false, error: "Barber neponúka túto službu." };
      }
      const { barber, bs } = loaded;
      const duration = bs.customDuration ?? bs.defaultDuration;
      const buffer = bs.bufferMinutes;
      const priceCents = bs.customPriceCents ?? bs.defaultPriceCents;

      const startTime = fromZonedTime(`${data.date}T${data.time}:00`, TIMEZONE);
      const endTime = addMinutes(startTime, duration);
      const startKey = dateKey(startTime);

      const { customerId } = await upsertCustomerByPhone({
        phone,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
      });

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
            const conflict = overlapping.docs.some((d) => {
              if (d.id === id) return false;
              const a = d.data() as AppointmentDoc;
              if (a.status === "CANCELLED" || a.status === "NO_SHOW") return false;
              return (
                a.startTime.toMillis() < endTime.getTime() &&
                a.endTime.toMillis() > startTime.getTime()
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
              customerName: `${data.firstName} ${data.lastName || ""}`.trim(),
              customerPhone: phone,
              customerEmail: data.email || null,
              notes: data.notes || null,
              updatedAt: Timestamp.now(),
            })
          );
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
    console.error("[deleteAppointment]", e);
    return { success: false, error: "Nastala chyba pri mazaní rezervácie." };
  }
}
