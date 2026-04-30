"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { stripUndefined } from "@/server/lib/firestore-utils";
import { serviceInputSchema } from "@/lib/validators";
import { randomUUID } from "crypto";

type ActionResult = { success: boolean; error?: string };

function invalidate() {
  revalidatePath("/");
  revalidatePath("/admin/services");
}

function toDoc(data: ReturnType<typeof serviceInputSchema.parse>) {
  return stripUndefined({
    name: data.name,
    description: data.description ?? null,
    durationMinutes: data.durationMinutes,
    priceCents: Math.round(Number(data.price) * 100),
    bufferMinutes: data.bufferMinutes,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  });
}

export async function createService(input: unknown): Promise<ActionResult> {
  try {
    const data = serviceInputSchema.parse(input);
    const id = randomUUID();
    await adminDb.doc(`services/${id}`).set({
      id,
      ...toDoc(data),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[createService]", e);
    return { success: false, error: "Nastala chyba pri vytváraní služby." };
  }
}

export async function updateService(
  id: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const data = serviceInputSchema.parse(input);
    await adminDb.doc(`services/${id}`).update({
      ...toDoc(data),
      updatedAt: Timestamp.now(),
    });

    // Sync denormalized fields on BarberService docs that reference this service
    const barberSnap = await adminDb.collection("barbers").get();
    await Promise.all(
      barberSnap.docs.map(async (b) => {
        const bsRef = adminDb.doc(`barbers/${b.id}/services/${id}`);
        const bsSnap = await bsRef.get();
        if (!bsSnap.exists) return;
        await bsRef.update({
          serviceName: data.name,
          defaultDuration: data.durationMinutes,
          bufferMinutes: data.bufferMinutes,
          defaultPriceCents: Math.round(Number(data.price) * 100),
        });
      })
    );

    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[updateService]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii služby." };
  }
}
