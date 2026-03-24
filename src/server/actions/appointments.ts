"use server";

import { prisma } from "@/server/lib/prisma";
import { AppointmentStatus } from "@/generated/prisma/client";
import { VALID_STATUS_TRANSITIONS } from "@/lib/constants";

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
