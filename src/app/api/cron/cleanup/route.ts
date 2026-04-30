import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { subHours, subMonths } from "date-fns";

/**
 * Periodic cleanup:
 * 1. AppointmentStatusHistory subcollection entries older than 12 months
 * 2. Phone rate-limit counters where every booking entry is older than 24h
 *
 * Firebase Auth sessions expire automatically, no cleanup needed.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const historyCutoff = Timestamp.fromDate(subMonths(new Date(), 12));

  // 1. Delete old history entries via collectionGroup query
  const historySnap = await adminDb
    .collectionGroup("history")
    .where("changedAt", "<", historyCutoff)
    .limit(500)
    .get();

  let deletedHistory = 0;
  if (!historySnap.empty) {
    const batches: FirebaseFirestore.WriteBatch[] = [];
    let current = adminDb.batch();
    let count = 0;
    for (const d of historySnap.docs) {
      current.delete(d.ref);
      count++;
      deletedHistory++;
      if (count >= 450) {
        batches.push(current);
        current = adminDb.batch();
        count = 0;
      }
    }
    if (count > 0) batches.push(current);
    for (const b of batches) await b.commit();
  }

  // 2. Cleanup phone rate-limit counters where all entries are stale
  const cutoff24hMs = subHours(new Date(), 24).getTime();
  const phoneCountersSnap = await adminDb
    .collection("counters")
    .where("__name__", ">=", "counters/phone_")
    .where("__name__", "<", "counters/phone_~")
    .get();

  let deletedCounters = 0;
  for (const d of phoneCountersSnap.docs) {
    const data = d.data() as { bookings?: Timestamp[] };
    const bookings = data.bookings ?? [];
    const allStale = bookings.every((t) => t.toMillis() < cutoff24hMs);
    if (allStale) {
      await d.ref.delete();
      deletedCounters++;
    }
  }

  return NextResponse.json({
    ok: true,
    deletedHistory,
    deletedPhoneCounters: deletedCounters,
  });
}
