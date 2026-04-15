import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { sendEmail } from "@/server/lib/email";
import { sendSMS } from "@/server/lib/sms";
import { bookingReminderHtml } from "@/emails/booking-reminder";
import { startOfDay, endOfDay, addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  // Verify cron secret — mandatory, reject if not configured
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Send reminders for all of tomorrow's appointments (runs once daily)
  const nowLocal = toZonedTime(new Date(), TIMEZONE);
  const tomorrow = addDays(nowLocal, 1);
  const reminderWindowStart = startOfDay(tomorrow);
  const reminderWindowEnd = endOfDay(tomorrow);

  // Find CONFIRMED appointments tomorrow with no reminder sent
  const appointments = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startTime: {
        gte: reminderWindowStart,
        lte: reminderWindowEnd,
      },
    },
    include: {
      barber: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
    },
  });

  let sent = 0;

  for (const appt of appointments) {
    if (!appt.customerEmail) continue;

    try {
      await sendEmail({
        to: appt.customerEmail,
        subject: "Pripomienka rezervácie — Strojček",
        html: bookingReminderHtml({
          customerName: appt.customerName || "zákazník",
          serviceName: appt.service.name,
          barberName: `${appt.barber.firstName} ${appt.barber.lastName}`,
          date: format(toZonedTime(appt.startTime, TIMEZONE), "d.M.yyyy"),
          time: format(toZonedTime(appt.startTime, TIMEZONE), "HH:mm"),
        }),
      });

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      });

      // Send SMS reminder
      if (appt.customerPhone) {
        await sendSMS({
          phone: appt.customerPhone,
          message: `Pripomienka: zajtra ${format(toZonedTime(appt.startTime, TIMEZONE), "HH:mm")} máte rezerváciu v Strojčeku (${appt.service.name}). Ak potrebujete zrušiť, použite odkaz z potvrdzovacieho emailu.`,
        }).catch((err) =>
          console.error(`[cron/reminders] SMS failed for ${appt.id}:`, err)
        );
      }

      sent++;
    } catch (err) {
      console.error(`[cron/reminders] Failed for appointment ${appt.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    found: appointments.length,
    sent,
  });
}
