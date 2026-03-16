"use server";

import { prisma } from "@/server/lib/prisma";
import { customerInputSchema } from "@/lib/validators";
import { normalizePhone } from "@/server/lib/phone";

type ActionResult = { success: boolean; error?: string };

export async function updateCustomer(id: string, input: unknown): Promise<ActionResult> {
  try {
    const data = customerInputSchema.parse(input);
    await prisma.customer.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: normalizePhone(data.phone),
        email: data.email || null,
        notes: data.notes || null,
      },
    });
    return { success: true };
  } catch (e) {
    console.error("[updateCustomer]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii zákazníka." };
  }
}
