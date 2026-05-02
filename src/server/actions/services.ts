"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { stripUndefined } from "@/server/lib/firestore-utils";
import { getSession } from "@/server/lib/auth";
import { serviceInputSchema } from "@/lib/validators";
import { randomUUID } from "crypto";

type ActionResult = { success: boolean; error?: string };

const UNAUTH: ActionResult = {
  success: false,
  error: "Neautorizovaný prístup.",
};

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
  if (!(await getSession())) return UNAUTH;
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
  if (!(await getSession())) return UNAUTH;
  try {
    const data = serviceInputSchema.parse(input);
    const newPriceCents = Math.round(Number(data.price) * 100);

    // Service doc + denormalized BarberService fields written in one
    // transaction. Previously a network blip mid-loop could leave
    // serviceName/defaultDuration/bufferMinutes/defaultPriceCents
    // inconsistent across barbers — some updated, some stale.
    //
    // Firestore transactions cap at 500 ops; one barber rarely has more
    // than a handful of services, and each barber contributes at most
    // one BarberService doc here, so we're well under the limit.
    await adminDb.runTransaction(async (tx) => {
      // --- READ phase ---
      const barberSnap = await tx.get(adminDb.collection("barbers"));
      const bsRefs = barberSnap.docs.map((b) =>
        adminDb.doc(`barbers/${b.id}/services/${id}`)
      );
      const bsSnaps = bsRefs.length
        ? await tx.getAll(...bsRefs)
        : [];

      // --- WRITE phase ---
      tx.update(adminDb.doc(`services/${id}`), {
        ...toDoc(data),
        updatedAt: Timestamp.now(),
      });
      for (const bsSnap of bsSnaps) {
        if (!bsSnap.exists) continue;
        tx.update(bsSnap.ref, {
          serviceName: data.name,
          defaultDuration: data.durationMinutes,
          bufferMinutes: data.bufferMinutes,
          defaultPriceCents: newPriceCents,
        });
      }
    });

    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[updateService]", e);
    return { success: false, error: "Nastala chyba pri aktualizácii služby." };
  }
}
