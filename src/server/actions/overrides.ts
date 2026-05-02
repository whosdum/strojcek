"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { adminDb } from "@/server/lib/firebase-admin";
import { getSession } from "@/server/lib/auth";
import { overrideInputSchema } from "@/lib/validators";
import { TIMEZONE } from "@/lib/constants";
import type { AppointmentDoc } from "@/server/types/firestore";

type ActionResult = {
  success: boolean;
  error?: string;
  conflictCount?: number;
  /** "day_off" when override hides every appointment, "out_of_hours"
   *  when custom hours leave some appointments outside the new window. */
  conflictKind?: "day_off" | "out_of_hours";
};

const UNAUTH: ActionResult = {
  success: false,
  error: "Neautorizovaný prístup.",
};

function invalidate() {
  revalidatePath("/");
  revalidatePath("/admin/schedule");
}

/**
 * Returns the Bratislava-local "today" key (YYYY-MM-DD). Computed via
 * `toZonedTime` + `format` so the calendar walks through midnight cleanly
 * even on DST-transition days; `Date#toLocaleDateString` would also work,
 * but date-fns-tz is the canonical TZ helper used elsewhere in the
 * project so we stay consistent.
 */
function todayKey(): string {
  return format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM-dd");
}

/**
 * Upsert a single-date override (day off OR custom hours).
 *
 * Conflict checks against existing active appointments on that date:
 *   - `isAvailable === false` (day off) → all active appointments conflict.
 *   - `isAvailable === true` (custom hours) → appointments whose Bratislava-
 *     local time falls outside the new `[startTime, endTime]` window
 *     conflict (they would silently disappear from the public wizard view).
 *
 * On conflict returns `{ success: false, error: "conflict", conflictCount,
 * conflictKind }` so the UI can show context-specific copy. Re-call with
 * `force: true` to write the override anyway. Existing appointments are
 * NOT auto-cancelled — the admin must contact customers manually.
 */
export async function upsertOverride(input: unknown): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const data = overrideInputSchema.parse(input);

    if (data.overrideDate < todayKey()) {
      return { success: false, error: "Nemožno pridať výnimku v minulosti." };
    }

    if (!data.force) {
      const conflicts = await adminDb
        .collection("appointments")
        .where("barberId", "==", data.barberId)
        .where("startDateKey", "==", data.overrideDate)
        .get();
      const active = conflicts.docs.filter((d) => {
        const a = d.data() as AppointmentDoc;
        return a.status !== "CANCELLED" && a.status !== "NO_SHOW";
      });

      if (active.length > 0) {
        if (data.isAvailable === false) {
          return {
            success: false,
            error: "conflict",
            conflictKind: "day_off",
            conflictCount: active.length,
          };
        }

        // Custom hours: only flag the ones that fall outside the new
        // window. Compare in Bratislava-local HH:mm so DST is irrelevant.
        const newStart = data.startTime!;
        const newEnd = data.endTime!;
        const outOfWindow = active.filter((d) => {
          const a = d.data() as AppointmentDoc;
          const aStart = format(
            toZonedTime(a.startTime.toDate(), TIMEZONE),
            "HH:mm"
          );
          const aEnd = format(
            toZonedTime(a.endTime.toDate(), TIMEZONE),
            "HH:mm"
          );
          return aStart < newStart || aEnd > newEnd;
        });
        if (outOfWindow.length > 0) {
          return {
            success: false,
            error: "conflict",
            conflictKind: "out_of_hours",
            conflictCount: outOfWindow.length,
          };
        }
      }
    }

    await adminDb
      .doc(`barbers/${data.barberId}/overrides/${data.overrideDate}`)
      .set(
        {
          overrideDate: data.overrideDate,
          isAvailable: data.isAvailable,
          startTime: data.isAvailable ? data.startTime ?? null : null,
          endTime: data.isAvailable ? data.endTime ?? null : null,
          reason: data.reason ? data.reason : null,
        },
        { merge: false }
      );

    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[upsertOverride]", e);
    if (e instanceof Error && e.name === "ZodError") {
      return { success: false, error: "Skontrolujte zadané údaje." };
    }
    return { success: false, error: "Nastala chyba pri ukladaní výnimky." };
  }
}

/**
 * Delete an override by composite id `${barberId}:${YYYY-MM-DD}`.
 */
export async function deleteOverride(id: string): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const [barberId, overrideDate] = id.split(":");
    if (!barberId || !overrideDate) {
      return { success: false, error: "Neplatné ID výnimky." };
    }
    await adminDb
      .doc(`barbers/${barberId}/overrides/${overrideDate}`)
      .delete();
    invalidate();
    return { success: true };
  } catch (e) {
    console.error("[deleteOverride]", e);
    return { success: false, error: "Nastala chyba." };
  }
}
