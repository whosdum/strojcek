"use server";

import { prisma } from "@/server/lib/prisma";
import { AppointmentStatus } from "@/generated/prisma/client";
import { TIMEZONE, VALID_STATUS_TRANSITIONS } from "@/lib/constants";
import {
  adminAppointmentInputSchema,
  adminAppointmentEditSchema,
} from "@/lib/validators";
import { normalizePhone } from "@/server/lib/phone";
import { generateToken, hashToken } from "@/server/lib/tokens";
import { sendEmail } from "@/server/lib/email";
import { bookingConfirmationHtml } from "@/emails/booking-confirmation";
import { addMinutes, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";

type ActionResult = { success: boolean; error?: string; appointmentId?: string };

export async function updateAppointmentStatus(
  id: string,
  newStatus: AppointmentStatus,
  reason?: string
): Promise<ActionResult> {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!appointment) {
      return { success: false, error: "Rezervácia nenájdená." };
    }

    if (appointment.status === newStatus) {
      return { success: true };
    }

    const allowed = VALID_STATUS_TRANSITIONS[appointment.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Nie je možné zmeniť stav z "${appointment.status}" na "${newStatus}".`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: id,
          oldStatus: appointment.status,
          newStatus,
          changedBy: "admin",
          reason,
        },
      });

      // Adjust visitCount: +1 when completing, -1 when leaving completed
      if (appointment.customerId) {
        if (newStatus === "COMPLETED" && appointment.status !== "COMPLETED") {
          await tx.customer.update({
            where: { id: appointment.customerId },
            data: { visitCount: { increment: 1 } },
          });
        } else if (appointment.status === "COMPLETED" && newStatus !== "COMPLETED") {
          await tx.customer.update({
            where: { id: appointment.customerId },
            data: { visitCount: { decrement: 1 } },
          });
        }
      }
    });

    return { success: true };
  } catch (e) {
    console.error("[updateAppointmentStatus]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii." };
  }
}

export async function createAppointmentAdmin(input: unknown): Promise<ActionResult> {
  try {
    const data = adminAppointmentInputSchema.parse(input);
    const phone = normalizePhone(data.phone);

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

    const startTime = fromZonedTime(`${data.date}T${data.time}:00`, TIMEZONE);
    const endTime = addMinutes(startTime, duration);

    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email,
      },
      create: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        phone,
        email: data.email,
        visitCount: 0,
      },
    });

    const rawToken = generateToken();
    const hashedToken = hashToken(rawToken);

    let appointmentId: string;
    try {
      const appointment = await prisma.$transaction(async (tx) => {
        if (!data.ignoreSchedule) {
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
            customerName: `${data.firstName} ${data.lastName || ""}`.trim(),
            customerPhone: phone,
            customerEmail: data.email,
            cancellationToken: hashedToken,
            notes: data.notes || null,
            source: "admin",
          },
        });

        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: appt.id,
            oldStatus: null,
            newStatus: "CONFIRMED",
            changedBy: "admin",
          },
        });

        return appt;
      });
      appointmentId = appointment.id;
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "SLOT_TAKEN") {
        return {
          success: false,
          error: "Tento termín je obsadený. Zapnite „Ignorovať rozvrh“ alebo zvoľte iný čas.",
        };
      }
      const pgError = e as { code?: string };
      if (pgError.code === "23P01") {
        return {
          success: false,
          error: "Tento termín je obsadený. Zapnite „Ignorovať rozvrh“ alebo zvoľte iný čas.",
        };
      }
      throw e;
    }

    // Send confirmation email (non-blocking — log on failure but don't fail the action)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cancelUrl = `${appUrl}/cancel?token=${rawToken}`;
    const localStart = toZonedTime(startTime, TIMEZONE);
    sendEmail({
      to: data.email,
      subject: "Potvrdenie rezervácie - Strojček",
      html: bookingConfirmationHtml({
        customerName: data.firstName,
        serviceName: service.name,
        barberName: `${barber.firstName} ${barber.lastName}`,
        date: format(localStart, "d.M.yyyy"),
        time: format(localStart, "HH:mm"),
        price: price.toString(),
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

export async function updateAppointment(id: string, input: unknown): Promise<ActionResult> {
  try {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Rezervácia nenájdená." };
    }

    if (existing.status === "CANCELLED" || existing.status === "NO_SHOW") {
      return { success: false, error: "Túto rezerváciu už nie je možné upraviť." };
    }

    const data = adminAppointmentEditSchema.parse(input);
    const limited = existing.status === "IN_PROGRESS" || existing.status === "COMPLETED";

    if (limited) {
      const priceFinal =
        data.priceFinal === "" || data.priceFinal === null || data.priceFinal === undefined
          ? null
          : data.priceFinal;

      await prisma.appointment.update({
        where: { id },
        data: {
          notes: data.notes || null,
          priceFinal,
        },
      });
    } else {
      const phone = normalizePhone(data.phone);

      const barberService = await prisma.barberService.findUnique({
        where: {
          barberId_serviceId: {
            barberId: data.barberId,
            serviceId: data.serviceId,
          },
        },
        include: { service: true },
      });

      if (!barberService) {
        return { success: false, error: "Barber neponúka túto službu." };
      }

      const duration = barberService.customDuration ?? barberService.service.durationMinutes;
      const price = barberService.customPrice ?? barberService.service.price;

      const startTime = fromZonedTime(`${data.date}T${data.time}:00`, TIMEZONE);
      const endTime = addMinutes(startTime, duration);

      const customer = await prisma.customer.upsert({
        where: { phone },
        update: {
          firstName: data.firstName,
          lastName: data.lastName || null,
          email: data.email || null,
        },
        create: {
          firstName: data.firstName,
          lastName: data.lastName || null,
          phone,
          email: data.email || null,
          visitCount: 0,
        },
      });

      const priceFinal =
        data.priceFinal === "" || data.priceFinal === null || data.priceFinal === undefined
          ? null
          : data.priceFinal;

      try {
        await prisma.$transaction(async (tx) => {
          if (!data.ignoreSchedule) {
            const overlapping = await tx.appointment.findFirst({
              where: {
                id: { not: id },
                barberId: data.barberId,
                status: { notIn: ["CANCELLED", "NO_SHOW"] },
                startTime: { lt: endTime },
                endTime: { gt: startTime },
              },
            });
            if (overlapping) {
              throw new Error("SLOT_TAKEN");
            }
          }

          await tx.appointment.update({
            where: { id },
            data: {
              barberId: data.barberId,
              serviceId: data.serviceId,
              customerId: customer.id,
              startTime,
              endTime,
              priceExpected: price,
              priceFinal,
              customerName: `${data.firstName} ${data.lastName || ""}`.trim(),
              customerPhone: phone,
              customerEmail: data.email || null,
              notes: data.notes || null,
            },
          });
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "SLOT_TAKEN") {
          return {
            success: false,
            error: "Tento termín je obsadený. Zapnite „Ignorovať rozvrh“ alebo zvoľte iný čas.",
          };
        }
        const pgError = e as { code?: string };
        if (pgError.code === "23P01") {
          return {
            success: false,
            error: "Tento termín je obsadený. Zapnite „Ignorovať rozvrh“ alebo zvoľte iný čas.",
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
  try {
    await prisma.$transaction(async (tx) => {
      // If it was COMPLETED, decrement visitCount
      const appointment = await tx.appointment.findUnique({ where: { id } });
      if (appointment?.status === "COMPLETED" && appointment.customerId) {
        await tx.customer.update({
          where: { id: appointment.customerId },
          data: { visitCount: { decrement: 1 } },
        });
      }

      await tx.appointmentStatusHistory.deleteMany({ where: { appointmentId: id } });
      await tx.appointment.delete({ where: { id } });
    });

    return { success: true };
  } catch (e) {
    console.error("[deleteAppointment]", e);
    return { success: false, error: "Nastala chyba pri mazaní rezervácie." };
  }
}
