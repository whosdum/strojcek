"use server";

import { prisma } from "@/server/lib/prisma";
import { bookingInputSchema, cancelBookingInputSchema } from "@/lib/validators";
import { normalizePhone } from "@/server/lib/phone";
import { generateToken, getTokenLookupValues, hashToken } from "@/server/lib/tokens";
import { sendEmail } from "@/server/lib/email";
import { sendSMS } from "@/server/lib/sms";
import { escapeTelegramHtml, sendTelegramNotification } from "@/server/lib/telegram";
import { bookingConfirmationHtml } from "@/emails/booking-confirmation";
import { bookingCancellationHtml } from "@/emails/booking-cancellation";
import { MIN_CANCEL_HOURS, CANCELLABLE_STATUSES, TIMEZONE } from "@/lib/constants";
import { addMinutes, format, addHours, isBefore } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

type ActionResult = {
  success: boolean;
  error?: string;
  appointmentId?: string;
};

export async function createBooking(input: unknown): Promise<ActionResult> {
  try {
    const data = bookingInputSchema.parse(input);
    const phone = normalizePhone(data.phone);

    // Get effective price and duration
    const barberService = await prisma.barberService.findUnique({
      where: {
        barberId_serviceId: {
          barberId: data.barberId,
          serviceId: data.serviceId,
        },
      },
      include: { service: true, barber: true },
    });

    if (!barberService) {
      return { success: false, error: "Barber neponúka túto službu." };
    }

    const service = barberService.service;
    const barber = barberService.barber;
    const duration = barberService.customDuration ?? service.durationMinutes;
    const price = barberService.customPrice ?? service.price;

    // Calculate start and end times (interpret date+time as Europe/Bratislava)
    const startTime = fromZonedTime(`${data.date}T${data.time}:00`, TIMEZONE);
    const endTime = addMinutes(startTime, duration);

    // Find or create customer (identified by normalized phone)
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      },
      create: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone,
        email: data.email,
        visitCount: 0,
      },
    });

    // Generate cancellation token
    const rawToken = generateToken();
    const hashedToken = hashToken(rawToken);

    // Create appointment in transaction with overlap check
    let appointmentId: string;
    try {
      const appointment = await prisma.$transaction(async (tx) => {
        // Check for overlapping appointments (app-level buffer check)
        const overlapping = await tx.appointment.findFirst({
          where: {
            barberId: data.barberId,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        });

        if (overlapping) {
          throw new Error("SLOT_TAKEN");
        }

        const appt = await tx.appointment.create({
          data: {
            barberId: data.barberId,
            customerId: customer.id,
            serviceId: data.serviceId,
            startTime,
            endTime,
            status: "CONFIRMED",
            priceExpected: price,
            customerName: `${data.firstName} ${data.lastName}`.trim(),
            customerPhone: phone,
            customerEmail: data.email || null,
            cancellationToken: hashedToken,
            notes: data.note || null,
            source: "online",
          },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: appt.id,
            oldStatus: null,
            newStatus: "CONFIRMED",
            changedBy: "system",
          },
        });

        return appt;
      });

      appointmentId = appointment.id;
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "SLOT_TAKEN") {
        return {
          success: false,
          error: "Tento termín bol práve obsadený. Vyberte prosím iný čas.",
        };
      }
      // PostgreSQL exclusion constraint violation
      const pgError = e as { code?: string };
      if (pgError.code === "23P01") {
        return {
          success: false,
          error: "Tento termín bol práve obsadený. Vyberte prosím iný čas.",
        };
      }
      throw e;
    }

    // Send notifications (awaited so they complete before serverless function exits)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cancelUrl = `${appUrl}/cancel?token=${rawToken}`;
    const localStart = toZonedTime(startTime, TIMEZONE);
    const formattedDate = format(localStart, "d.M.yyyy");
    const formattedTime = format(localStart, "HH:mm");
    const barberName = `${barber.firstName} ${barber.lastName}`;

    const notifications: Promise<unknown>[] = [];

    // Email confirmation
    if (data.email) {
      notifications.push(
        sendEmail({
          to: data.email,
          subject: "Potvrdenie rezervácie - Strojček",
          html: bookingConfirmationHtml({
            customerName: data.firstName,
            serviceName: service.name,
            barberName,
            date: formattedDate,
            time: formattedTime,
            price: price.toString(),
            cancelUrl,
            startTimeUtc: startTime.toISOString(),
            endTimeUtc: endTime.toISOString(),
          }),
        }).catch((err) => console.error("[EMAIL]", err))
      );
    }

    // SMS confirmation
    notifications.push(
      sendSMS({
        phone,
        message: `Rezervácia potvrdená: ${service.name} u ${barberName}, ${formattedDate} o ${formattedTime}. Pre zrusenie zavolajte 0944 932 871 alebo pouzite odkaz v potvrdzujucom emaili.`,
      }).catch((err) => console.error("[SMS]", err))
    );

    // Telegram notification to barber
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      notifications.push(
        sendTelegramNotification({
          chatId,
          message:
            `<b>Nová rezervácia</b>\n` +
            `Zákazník: ${escapeTelegramHtml(`${data.firstName} ${data.lastName || ""}`.trim())}\n` +
            `Služba: ${escapeTelegramHtml(service.name)}\n` +
            `Dátum: ${escapeTelegramHtml(formattedDate)} o ${escapeTelegramHtml(formattedTime)}\n` +
            `Tel: ${escapeTelegramHtml(phone)}` +
            `${data.email ? `\nEmail: ${escapeTelegramHtml(data.email)}` : ""}`,
        }).catch((err) => console.error("[TELEGRAM]", err))
      );
    }

    await Promise.all(notifications);

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

    let appointment = await prisma.appointment.findUnique({
      where: { cancellationToken: primaryToken },
      include: {
        barber: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    });

    if (!appointment && fallbackToken) {
      appointment = await prisma.appointment.findUnique({
        where: { cancellationToken: fallbackToken },
        include: {
          barber: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
        },
      });
    }

    if (!appointment) {
      return { success: false, error: "Neplatný alebo expirovaný odkaz." };
    }

    if (!CANCELLABLE_STATUSES.includes(appointment.status)) {
      return { success: false, error: "Táto rezervácia už bola zrušená." };
    }

    const now = toZonedTime(new Date(), TIMEZONE);
    const minCancelTime = addHours(now, MIN_CANCEL_HOURS);
    if (isBefore(appointment.startTime, minCancelTime)) {
      return {
        success: false,
        error: `Rezerváciu je možné zrušiť najneskôr ${MIN_CANCEL_HOURS} hodiny pred termínom.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "CANCELLED",
          cancellationReason,
        },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: appointment.id,
          oldStatus: appointment.status,
          newStatus: "CANCELLED",
          changedBy: "customer",
          reason: cancellationReason
            ? `Zrušené zákazníkom: ${cancellationReason}`
            : "Zrušené zákazníkom",
        },
      });
    });

    // Send cancellation notifications (awaited for serverless)
    const localCancelStart = toZonedTime(appointment.startTime, TIMEZONE);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cancelBarberName = `${appointment.barber.firstName} ${appointment.barber.lastName}`;
    const cancelNotifications: Promise<unknown>[] = [];

    if (appointment.customerEmail) {
      cancelNotifications.push(
        sendEmail({
          to: appointment.customerEmail,
          subject: "Rezervácia zrušená - Strojček",
          html: bookingCancellationHtml({
            customerName: appointment.customerName || "zákazník",
            serviceName: appointment.service.name,
            barberName: cancelBarberName,
            date: format(localCancelStart, "d.M.yyyy"),
            time: format(localCancelStart, "HH:mm"),
            bookUrl: appUrl,
          }),
        }).catch((err) => console.error("[EMAIL]", err))
      );
    }

    // Telegram notification to barber
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      const formattedDate = format(localCancelStart, "d.M.yyyy");
      const formattedTime = format(localCancelStart, "HH:mm");
      const safeCustomerName = escapeTelegramHtml(appointment.customerName || "neznámy");
      const safeServiceName = escapeTelegramHtml(appointment.service.name);
      const safePhone = appointment.customerPhone
        ? escapeTelegramHtml(appointment.customerPhone)
        : null;
      const safeReason = cancellationReason
        ? escapeTelegramHtml(cancellationReason)
        : null;

      cancelNotifications.push(
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

    await Promise.all(cancelNotifications);

    return { success: true };
  } catch (e) {
    console.error("[cancelBooking]", e);
    if (e instanceof Error && e.name === "ZodError") {
      return { success: false, error: "Skontrolujte odkaz alebo dôvod zrušenia." };
    }
    return { success: false, error: "Nastala neočakávaná chyba. Skúste to znova." };
  }
}
