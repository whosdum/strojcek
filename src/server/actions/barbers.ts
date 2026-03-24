"use server";

import { prisma } from "@/server/lib/prisma";
import { barberInputSchema } from "@/lib/validators";

type ActionResult = { success: boolean; error?: string };

export async function createBarber(input: unknown): Promise<ActionResult> {
  try {
    const data = barberInputSchema.parse(input);
    await prisma.barber.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        bio: data.bio || null,
        avatarUrl: data.avatarUrl || null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    return { success: true };
  } catch (e) {
    console.error("[createBarber]", e);
    return { success: false, error: "Nastala chyba pri vytváraní barbera." };
  }
}

export async function updateBarber(id: string, input: unknown): Promise<ActionResult> {
  try {
    const data = barberInputSchema.parse(input);
    await prisma.barber.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        bio: data.bio || null,
        avatarUrl: data.avatarUrl || null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    return { success: true };
  } catch (e) {
    console.error("[updateBarber]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii barbera." };
  }
}

export async function updateBarberServices(
  barberId: string,
  serviceIds: string[]
): Promise<ActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.barberService.deleteMany({ where: { barberId } });
      if (serviceIds.length > 0) {
        await tx.barberService.createMany({
          data: serviceIds.map((serviceId) => ({ barberId, serviceId })),
        });
      }
    });
    return { success: true };
  } catch (e) {
    console.error("[updateBarberServices]", e);
    return { success: false, error: "Nastala chyba." };
  }
}
