"use server";

import { prisma } from "@/server/lib/prisma";
import { customerInputSchema } from "@/lib/validators";
import { normalizePhone } from "@/server/lib/phone";
import { revalidatePath } from "next/cache";

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
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (e) {
    console.error("[updateCustomer]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii zákazníka." };
  }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  try {
    // Detach appointments from customer (keep appointment records)
    await prisma.appointment.updateMany({
      where: { customerId: id },
      data: { customerId: null },
    });

    await prisma.customer.delete({ where: { id } });

    revalidatePath("/admin/customers");
    return { success: true };
  } catch (e) {
    console.error("[deleteCustomer]", e);
    return { success: false, error: "Nastala chyba pri mazaní zákazníka." };
  }
}
