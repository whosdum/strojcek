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
  for (const d of candidates) {
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

      await d.ref.update({ reminderSentAt: Timestamp.now() });

      if (appt.customerPhone) {
        sendSMS({
          phone: appt.customerPhone,
          message: `Strojcek: zajtra o ${format(toZonedTime(appt.startTime.toDate(), TIMEZONE), "HH:mm")} mate rezervaciu na ${stripDiacritics(appt.serviceName)}. Pre zrusenie zavolajte ${SHOP_PHONE_DISPLAY}.`,
        }).catch((err) =>
          console.error(`[cron/reminders] SMS failed for ${d.id}:`, err)
        );
      }

      sent++;
    } catch (err) {
      console.error(`[cron/reminders] Failed for appointment ${d.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    found: candidates.length,
    sent,
  });
}
