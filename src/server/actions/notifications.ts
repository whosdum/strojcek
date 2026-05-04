"use server";

import { adminDb } from "@/server/lib/firebase-admin";
import { getSession } from "@/server/lib/auth";
import { sendEmail } from "@/server/lib/email";
import { sendSMS } from "@/server/lib/sms";
import { stripDiacritics } from "@/server/lib/strings";
import {
  extractSendError,
  recordNotification,
} from "@/server/lib/notification-log";
import { bookingConfirmationHtml } from "@/emails/booking-confirmation";
import { bookingCancellationHtml } from "@/emails/booking-cancellation";
import { bookingReminderHtml } from "@/emails/booking-reminder";
import { TIMEZONE } from "@/lib/constants";
import { PUBLIC_SITE_URL, SHOP_PHONE_DISPLAY } from "@/lib/business-info";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Timestamp } from "firebase-admin/firestore";
import { dateKey } from "@/server/lib/firestore-utils";
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
  // Raw cancellation token is not recoverable post-create (only the
  // hash is stored); the resent email points at the public site root
  // and the customer follows the original confirmation if they need
  // to cancel. Same compromise as the reminder template.
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
    error: result.success ? null : extractSendError(result.error),
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
    error: result.success ? null : extractSendError(result.error),
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

  // Reminder loop logic. Mirrors src/app/api/cron/reminders/route.ts but
  // marks every recordNotification call with trigger="manual". We can't
  // import from a route module (Next.js forbids it), hence the duplication;
  // see TODO in the design doc about extracting into a shared lib.
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
