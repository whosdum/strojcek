import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { dateKey } from "@/server/lib/firestore-utils";
import { verifyCronAuth } from "@/server/lib/cron-auth";
import { sendEmail } from "@/server/lib/email";
import { sendSMS } from "@/server/lib/sms";
import { stripDiacritics } from "@/server/lib/strings";
import { bookingReminderHtml } from "@/emails/booking-reminder";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { SHOP_PHONE_DISPLAY } from "@/lib/business-info";
import type { AppointmentDoc } from "@/server/types/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  const nowLocal = toZonedTime(new Date(), TIMEZONE);
  const tomorrowKey = dateKey(addDays(nowLocal, 1));

  const snap = await adminDb
    .collection("appointments")
    .where("startDateKey", "==", tomorrowKey)
    .where("status", "==", "CONFIRMED")
    .get();

  const candidates = snap.docs.filter((d) => {
    const data = d.data() as AppointmentDoc;
    return data.reminderSentAt == null;
  });

  let sent = 0;
  let failed = 0;
  let smsFailed = 0;
  for (const d of candidates) {
    // Lock-then-send: claim the appointment by setting reminderSentAt
    // INSIDE a transaction before any notification goes out. If two
    // cron runs race (workflow_dispatch on top of scheduled), only one
    // wins the transaction; the other sees reminderSentAt already set
    // and skips. The cost is "lost reminder on send failure" rather
    // than "duplicate reminder on retry" — preferable since the
    // customer always has the cancel link from the confirmation email.
    let claimed = false;
    try {
      await adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(d.ref);
        if (!fresh.exists) return;
        const data = fresh.data() as AppointmentDoc;
        if (data.reminderSentAt != null) return;
        if (data.status !== "CONFIRMED") return;
        tx.update(d.ref, { reminderSentAt: Timestamp.now() });
        claimed = true;
      });
    } catch (err) {
      console.error(`[cron/reminders] Lock failed for ${d.id}:`, err);
      failed++;
      continue;
    }
    if (!claimed) continue;

    const appt = d.data() as AppointmentDoc;
    if (!appt.customerEmail) continue;

    try {
      await sendEmail({
        to: appt.customerEmail,
        subject: "Pripomienka rezervácie — Strojček",
        html: bookingReminderHtml({
          customerName: appt.customerName || "zákazník",
          serviceName: appt.serviceName,
          barberName: appt.barberName,
          date: format(toZonedTime(appt.startTime.toDate(), TIMEZONE), "d.M.yyyy"),
          time: format(toZonedTime(appt.startTime.toDate(), TIMEZONE), "HH:mm"),
        }),
      });

      // SMS is awaited (Cloud Run may shut the instance down before a
      // detached fire-and-forget fetch lands at SMSTools). Tracked
      // independently of `failed` so the response distinguishes between
      // "email failed" (we count both) and "SMS failed" (email was OK).
      if (appt.customerPhone) {
        try {
          await sendSMS({
            phone: appt.customerPhone,
            message: `Strojcek: zajtra o ${format(toZonedTime(appt.startTime.toDate(), TIMEZONE), "HH:mm")} mate rezervaciu na ${stripDiacritics(appt.serviceName)}. Pre zrusenie zavolajte ${SHOP_PHONE_DISPLAY}.`,
          });
        } catch (err) {
          console.error(`[cron/reminders] SMS failed for ${d.id}:`, err);
          smsFailed++;
        }
      }

      sent++;
    } catch (err) {
      console.error(`[cron/reminders] Send failed for ${d.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    found: candidates.length,
    sent,
    failed,
    smsFailed,
  });
}
