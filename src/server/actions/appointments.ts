"use server";

import { prisma } from "@/server/lib/prisma";
import { VALID_STATUS_TRANSITIONS } from "@/lib/constants";
import { AppointmentStatus } from "@/generated/prisma/client";

type ActionResult = { success: boolean; error?: string };

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

    const allowed = VALID_STATUS_TRANSITIONS[appointment.status] || [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Prechod z ${appointment.status} na ${newStatus} nie je povolený.`,
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

      // Increment visitCount when completing
      if (newStatus === "COMPLETED" && appointment.customerId) {
        await tx.customer.update({
          where: { id: appointment.customerId },
          data: { visitCount: { increment: 1 } },
        });
      }
    });

    return { success: true };
  } catch (e) {
    console.error("[updateAppointmentStatus]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii." };
  }
}

export async function updateAppointmentNotes(
  id: string,
  notes: string
): Promise<ActionResult> {
  try {
    await prisma.appointment.update({
      where: { id },
      data: { notes },
    });
    return { success: true };
  } catch (e) {
    console.error("[updateAppointmentNotes]", e);
    return { success: false, error: "Nastala chyba." };
  }
}
