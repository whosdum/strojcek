"use server";

import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { revalidatePath } from "next/cache";

const VALID_INTERVALS = [15, 30, 60] as const;

type ActionResult = { success: boolean; error?: string };

export async function updateSlotInterval(
  minutes: number
): Promise<ActionResult> {
  if (!VALID_INTERVALS.includes(minutes as (typeof VALID_INTERVALS)[number])) {
    return {
      success: false,
      error: `Neplatný interval. Povolené hodnoty: ${VALID_INTERVALS.join(", ")} minút.`,
    };
  }

  await adminDb.doc("shopSettings/default").set(
    {
      slotIntervalMinutes: minutes,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  revalidatePath("/admin/schedule");
  return { success: true };
}
