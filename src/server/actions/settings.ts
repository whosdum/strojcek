"use server";

import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { getSession } from "@/server/lib/auth";
import { revalidatePath } from "next/cache";

const VALID_INTERVALS = [15, 30, 60] as const;

type ActionResult = { success: boolean; error?: string };

export async function updateSlotInterval(
  minutes: number
): Promise<ActionResult> {
  if (!(await getSession())) {
    return { success: false, error: "Neautorizovaný prístup." };
  }
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

const VALID_LEAD_MINUTES = [15, 30, 60, 120, 180] as const;

export async function updateMinBookingLead(
  minutes: number
): Promise<ActionResult> {
  if (!(await getSession())) {
    return { success: false, error: "Neautorizovaný prístup." };
  }
  if (
    !VALID_LEAD_MINUTES.includes(minutes as (typeof VALID_LEAD_MINUTES)[number])
  ) {
    return {
      success: false,
      error: `Neplatná hodnota. Povolené hodnoty: ${VALID_LEAD_MINUTES.join(", ")} minút.`,
    };
  }

  await adminDb.doc("shopSettings/default").set(
    {
      minBookingLeadMinutes: minutes,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  revalidatePath("/admin/schedule");
  return { success: true };
}
