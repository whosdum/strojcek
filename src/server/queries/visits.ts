import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import type { AppointmentStatus } from "@/lib/types";

/** Firestore caps `in` filters at 30 values. */
const IN_CHUNK = 30;

/**
 * Visits per customer = appointments that already started and weren't
 * cancelled / no-show. Computed from appointments rather than read from
 * `customers.visitCount`, which only counts COMPLETED — a status this
 * shop rarely sets, so the stored counter stays near 0.
 */
export async function countVisits(
  customerIds: string[]
): Promise<Map<string, number>> {
  const ids = [...new Set(customerIds)];
  const counts = new Map<string, number>(ids.map((id) => [id, 0]));
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
      const start = d.get("startTime") as FirebaseFirestore.Timestamp;
      if (start.toMillis() > nowMs) continue;
      const cid = d.get("customerId") as string;
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
  }
  return counts;
}
