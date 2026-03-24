"use server";

import { prisma } from "@/server/lib/prisma";
import { serviceInputSchema } from "@/lib/validators";

type ActionResult = { success: boolean; error?: string };

export async function createService(input: unknown): Promise<ActionResult> {
  try {
    const data = serviceInputSchema.parse(input);
    await prisma.service.create({ data });
    return { success: true };
  } catch (e) {
    console.error("[createService]", e);
    return { success: false, error: "Nastala chyba pri vytváraní služby." };
  }
}

export async function updateService(id: string, input: unknown): Promise<ActionResult> {
  try {
    const data = serviceInputSchema.parse(input);
    await prisma.service.update({ where: { id }, data });
    return { success: true };
  } catch (e) {
    console.error("[updateService]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii služby." };
  }
}
