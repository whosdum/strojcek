"use server";

import { revalidatePath } from "next/cache";
import { adminDb } from "@/server/lib/firebase-admin";
import { stripUndefined } from "@/server/lib/firestore-utils";
import { scheduleInputSchema, breakInputSchema } from "@/lib/validators";
import { randomUUID } from "crypto";

type ActionResult = { success: boolean; error?: string };

function invalidate() {
  revalidatePath("/");
  revalidatePath("/admin/schedule");
}

export async function upsertSchedule(input: unknown): Promise<ActionResult> {
  try {
    const data = scheduleInputSchema.parse(input);
    const ref = adminDb.doc(
      `barbers/${data.barberId}/schedules/${data.dayOfWeek}`
    );
    await ref.set(
      stripUndefined({
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: data.isActive,
      }),
      { merge: false }
    );
    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[upsertSchedule]", e);
    return { success: false, error: "Nastala chyba pri ukladaní rozvrhu." };
  }
}

/**
 * Delete schedule by composite id `${barberId}:${dayOfWeek}` OR by document id.
 * Older callers passed the Postgres UUID; new ones pass `barberId:dayOfWeek` so we
 * can find the doc directly.
 */
export async function deleteSchedule(id: string): Promise<ActionResult> {
  try {
    const [barberId, dayOfWeek] = id.split(":");
    if (!barberId || !dayOfWeek) {
      return { success: false, error: "Neplatné ID rozvrhu." };
    }
    await adminDb.doc(`barbers/${barberId}/schedules/${dayOfWeek}`).delete();
    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[deleteSchedule]", e);
    return { success: false, error: "Nastala chyba." };
  }
}

export async function createBreak(input: unknown): Promise<ActionResult> {
  try {
    const data = breakInputSchema.parse(input);
    const id = randomUUID();
    await adminDb.doc(`barbers/${data.barberId}/breaks/${id}`).set({
      id,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      label: data.label ?? "Prestavka",
    });
    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[createBreak]", e);
    return { success: false, error: "Nastala chyba pri vytváraní prestávky." };
  }
}

/**
 * Delete break by composite id `${barberId}:${breakId}`.
 */
export async function deleteBreak(id: string): Promise<ActionResult> {
  try {
    const [barberId, breakId] = id.split(":");
    if (!barberId || !breakId) {
      return { success: false, error: "Neplatné ID prestávky." };
    }
    await adminDb.doc(`barbers/${barberId}/breaks/${breakId}`).delete();
    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[deleteBreak]", e);
    return { success: false, error: "Nastala chyba." };
  }
}
