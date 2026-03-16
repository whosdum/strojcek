"use server";

import { prisma } from "@/server/lib/prisma";
import { bookingInputSchema, cancelBookingSchema } from "@/lib/validators";
import { normalizePhone } from "@/server/lib/phone";
import { generateToken, hashToken } from "@/server/lib/tokens";
import { sendEmail } from "@/server/lib/email";
import { sendSMS } from "@/server/lib/sms";
import { bookingConfirmationHtml } from "@/emails/booking-confirmation";
import { bookingCancellationHtml } from "@/emails/booking-cancellation";
import { MIN_CANCEL_HOURS, CANCELLABLE_STATUSES } from "@/lib/constants";
import { addMinutes, format, addHours, isBefore } from "date-fns";
import { parseISO } from "date-fns";

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

    // Calculate start and end times
    const [hours, mins] = data.time.split(":").map(Number);
    const startTime = parseISO(data.date);
    startTime.setHours(hours, mins, 0, 0);
    const endTime = addMinutes(startTime, duration);

    // Find or create customer
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {
        firstName: data.firstName,
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email && { email: data.email }),
      },
      create: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        phone,
        email: data.email || null,
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

    // Send notifications (non-blocking)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cancelUrl = `${appUrl}/cancel?token=${rawToken}`;
    const formattedDate = format(startTime, "d.M.yyyy");
    const formattedTime = format(startTime, "HH:mm");
    const barberName = `${barber.firstName} ${barber.lastName}`;

    // Email confirmation
    if (data.email) {
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
        }),
      }).catch(console.error);
    }

    // SMS confirmation
    sendSMS({
      phone,
      message: `Rezervácia potvrdená: ${service.name} u ${barberName}, ${formattedDate} o ${formattedTime}. Zrušiť: ${cancelUrl}`,
    }).catch(console.error);

    return { success: true, appointmentId };
  } catch (e) {
    console.error("[createBooking]", e);
    if (e instanceof Error && e.name === "ZodError") {
      return { success: false, error: "Neplatné údaje. Skontrolujte formulár." };
    }
    return { success: false, error: "Nastala neočakávaná chyba. Skúste to znova." };
  }
}

export async function cancelBooking(rawToken: string): Promise<ActionResult> {
  try {
    const hashedToken = hashToken(rawToken);

    const appointment = await prisma.appointment.findUnique({
      where: { cancellationToken: hashedToken },
      include: {
        barber: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    });

    if (!appointment) {
      return { success: false, error: "Neplatný alebo expirovaný odkaz." };
    }

    if (!CANCELLABLE_STATUSES.includes(appointment.status)) {
      return { success: false, error: "Táto rezervácia už bola zrušená." };
    }

    const minCancelTime = addHours(new Date(), MIN_CANCEL_HOURS);
    if (isBefore(appointment.startTime, minCancelTime)) {
      return {
        success: false,
        error: `Rezerváciu je možné zrušiť najneskôr ${MIN_CANCEL_HOURS} hodiny pred termínom.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: "CANCELLED" },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: appointment.id,
          oldStatus: appointment.status,
          newStatus: "CANCELLED",
          changedBy: "customer",
          reason: "Zrušené zákazníkom",
        },
      });
    });

    // Send cancellation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    if (appointment.customerEmail) {
      sendEmail({
        to: appointment.customerEmail,
        subject: "Rezervácia zrušená - Strojček",
        html: bookingCancellationHtml({
          customerName: appointment.customerName || "zákazník",
          serviceName: appointment.service.name,
          barberName: `${appointment.barber.firstName} ${appointment.barber.lastName}`,
          date: format(appointment.startTime, "d.M.yyyy"),
          time: format(appointment.startTime, "HH:mm"),
          bookUrl: `${appUrl}/book`,
        }),
      }).catch(console.error);
    }

    return { success: true };
  } catch (e) {
    console.error("[cancelBooking]", e);
    return { success: false, error: "Nastala neočakávaná chyba. Skúste to znova." };
  }
}
