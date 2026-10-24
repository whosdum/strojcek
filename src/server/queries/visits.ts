import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import type { AppointmentStatus } from "@/lib/types";

/** Firestore caps `in` filters at 30 values. */
const IN_CHUNK = 30;

/**
 * Start times (ms) of each customer's visits. A visit = an appointment that
 * already started and wasn't cancelled / no-show. Computed from
 * appointments rather than read from `customers.visitCount`, which only
 * counts COMPLETED — a status this shop rarely sets, so the stored counter
 * stays near 0.
 */
export async function getVisitStarts(
  customerIds: string[]
): Promise<Map<string, number[]>> {
  const ids = [...new Set(customerIds)];
  const starts = new Map<string, number[]>(ids.map((id) => [id, []]));
  const nowMs = Date.now();

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    chunks.push(ids.slice(i, i + IN_CHUNK));
  }
  const snaps = await Promise.all(
    chunks.map((chunk) =>
      adminDb
        .collection("appointments")
        .where("customerId", "in", chunk)
        .select("customerId", "status", "startTime")
        .get()
    )
  );

  for (const snap of snaps) {
    for (const d of snap.docs) {
      const status = d.get("status") as AppointmentStatus;
      if (status === "CANCELLED" || status === "NO_SHOW") continue;
      const startMs = (d.get("startTime") as FirebaseFirestore.Timestamp).toMillis();
      if (startMs > nowMs) continue;
      starts.get(d.get("customerId") as string)?.push(startMs);
    }
  }
  return starts;
}

/** Total visits per customer as of now. */
export async function countVisits(
  customerIds: string[]
): Promise<Map<string, number>> {
  const starts = await getVisitStarts(customerIds);
  return new Map([...starts].map(([id, s]) => [id, s.length]));
}

/** Visits that happened before the given appointment start — used where
 *  the admin looks at one booking ("had they been here before this?"). An
 *  appointment never counts itself. */
export function visitsBefore(starts: number[] | undefined, startMs: number): number {
  return (starts ?? []).filter((t) => t < startMs).length;
}
