"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { stripUndefined } from "@/server/lib/firestore-utils";
import { barberInputSchema } from "@/lib/validators";
import { randomUUID } from "crypto";
import type { ServiceDoc } from "@/server/types/firestore";

type ActionResult = { success: boolean; error?: string };

function invalidate() {
  revalidatePath("/");
  revalidatePath("/admin/barbers");
}

function toBarberData(data: ReturnType<typeof barberInputSchema.parse>) {
  return stripUndefined({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email || null,
    phone: data.phone || null,
    bio: data.bio || null,
    avatarUrl: data.avatarUrl || null,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  });
}

export async function createBarber(input: unknown): Promise<ActionResult> {
  try {
    const data = barberInputSchema.parse(input);
    const id = randomUUID();
    await adminDb.doc(`barbers/${id}`).set({
      id,
      ...toBarberData(data),
      serviceIds: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[createBarber]", e);
    return { success: false, error: "Nastala chyba pri vytváraní barbera." };
  }
}

export async function updateBarber(
  id: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const data = barberInputSchema.parse(input);
    await adminDb.doc(`barbers/${id}`).update({
      ...toBarberData(data),
      updatedAt: Timestamp.now(),
    });
    invalidate();
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
    const subColl = adminDb.collection(`barbers/${barberId}/services`);

    // Wipe existing
    const existing = await subColl.get();
    const wipeBatch = adminDb.batch();
    for (const d of existing.docs) wipeBatch.delete(d.ref);
    if (!existing.empty) await wipeBatch.commit();

    if (serviceIds.length > 0) {
      // Fetch services for denormalization
      const refs = serviceIds.map((id) => adminDb.doc(`services/${id}`));
      const snaps = await adminDb.getAll(...refs);

      const writeBatch = adminDb.batch();
      for (const s of snaps) {
        if (!s.exists) continue;
        const data = s.data() as ServiceDoc;
        writeBatch.set(subColl.doc(s.id), {
          serviceId: s.id,
          customPriceCents: null,
          customDuration: null,
          serviceName: data.name,
          defaultDuration: data.durationMinutes,
          bufferMinutes: data.bufferMinutes,
          defaultPriceCents: data.priceCents,
        });
      }
      await writeBatch.commit();
    }

    // Update denormalized barber.serviceIds for fast querying
    await adminDb.doc(`barbers/${barberId}`).update({
      serviceIds,
      updatedAt: Timestamp.now(),
    });

    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[updateBarberServices]", e);
    return { success: false, error: "Nastala chyba." };
  }
}
