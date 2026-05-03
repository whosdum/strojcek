"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { stripUndefined } from "@/server/lib/firestore-utils";
import { getSession } from "@/server/lib/auth";
import { barberInputSchema } from "@/lib/validators";
import { randomUUID } from "crypto";
import type { ServiceDoc } from "@/server/types/firestore";

type ActionResult = { success: boolean; error?: string; id?: string };

const UNAUTH: ActionResult = {
  success: false,
  error: "Neautorizovaný prístup.",
};

function invalidate() {
  revalidatePath("/");
  revalidatePath("/admin/barbers");
  revalidatePath("/admin/schedule");
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
    bookingHorizonWeeks: data.bookingHorizonWeeks,
  });
}

export async function createBarber(input: unknown): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
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
    return { success: true, id };
  } catch (e) {
    console.error("[createBarber]", e);
    return { success: false, error: "Nastala chyba pri vytváraní barbera." };
  }
}

export async function updateBarber(
  id: string,
  input: unknown
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
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

export async function updateBarberBookingHorizon(
  barberId: string,
  weeks: number
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 26) {
    return { success: false, error: "Horizont musí byť 1–26 týždňov." };
  }
  try {
    await adminDb.doc(`barbers/${barberId}`).update({
      bookingHorizonWeeks: weeks,
      updatedAt: Timestamp.now(),
    });
    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[updateBarberBookingHorizon]", e);
    return { success: false, error: "Nastala chyba." };
  }
}

export async function updateBarberServices(
  barberId: string,
  serviceIds: string[]
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const subColl = adminDb.collection(`barbers/${barberId}/services`);

    // One transaction: wipe existing sub-docs, write new ones, update the
    // denormalized parent. Avoids the previous wipe-then-write window where
    // a network failure between the two batches would leave the barber
    // with zero assigned services until the next save. Firestore allows
    // up to 500 ops per transaction; a barber realistically has < 50
    // services so we're well under the limit.
    await adminDb.runTransaction(async (tx) => {
      // --- READ phase (must come before any write in a Firestore tx) ---
      const existingSnap = await tx.get(subColl);
      const newServiceSnaps =
        serviceIds.length > 0
          ? await tx.getAll(
              ...serviceIds.map((id) => adminDb.doc(`services/${id}`))
            )
          : [];

      // Preserve per-barber custom price/duration overrides for services
      // that remain in the new list. The previous wipe-and-recreate
      // unconditionally cleared customPriceCents/customDuration, which
      // silently destroyed premium pricing the moment HR edited which
      // services a barber offered.
      const existingOverrides = new Map<
        string,
        { customPriceCents: number | null; customDuration: number | null }
      >();
      for (const d of existingSnap.docs) {
        const data = d.data() as {
          customPriceCents?: number | null;
          customDuration?: number | null;
        };
        existingOverrides.set(d.id, {
          customPriceCents: data.customPriceCents ?? null,
          customDuration: data.customDuration ?? null,
        });
      }

      // --- WRITE phase ---
      for (const d of existingSnap.docs) {
        tx.delete(d.ref);
      }
      for (const s of newServiceSnaps) {
        if (!s.exists) continue;
        const data = s.data() as ServiceDoc;
        const prev = existingOverrides.get(s.id);
        tx.set(subColl.doc(s.id), {
          serviceId: s.id,
          customPriceCents: prev?.customPriceCents ?? null,
          customDuration: prev?.customDuration ?? null,
          serviceName: data.name,
          defaultDuration: data.durationMinutes,
          bufferMinutes: data.bufferMinutes,
          defaultPriceCents: data.priceCents,
        });
      }
      tx.update(adminDb.doc(`barbers/${barberId}`), {
        serviceIds,
        updatedAt: Timestamp.now(),
      });
    });

    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[updateBarberServices]", e);
    return { success: false, error: "Nastala chyba." };
  }
}
