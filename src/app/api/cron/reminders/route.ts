import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { sendEmail } from "@/server/lib/email";
import { bookingReminderHtml } from "@/emails/booking-reminder";
import { addHours, format } from "date-fns";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const reminderWindowStart = addHours(now, 23);
  const reminderWindowEnd = addHours(now, 25);

  // Find CONFIRMED appointments 23-25h away with no reminder sent
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    // Note: we don't have the raw token, so cancel link can't be generated here.
    // The original cancel URL was sent in the confirmation email.
    const cancelUrl = `${appUrl}/book`;

    try {
      await sendEmail({
        to: appt.customerEmail,
        subject: "Pripomienka rezervácie — Strojček",
        html: bookingReminderHtml({
          customerName: appt.customerName || "zákazník",
          serviceName: appt.service.name,
          barberName: `${appt.barber.firstName} ${appt.barber.lastName}`,
          date: format(appt.startTime, "d.M.yyyy"),
          time: format(appt.startTime, "HH:mm"),
          cancelUrl,
        }),
      });

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      });

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
