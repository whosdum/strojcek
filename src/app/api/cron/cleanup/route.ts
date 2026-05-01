import { NextRequest, NextResponse } from "next/server";
import { Timestamp, FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { verifyCronAuth } from "@/server/lib/cron-auth";
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
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  const historyCutoff = Timestamp.fromDate(subMonths(new Date(), 12));

  // 1. Delete old history entries via collectionGroup query.
  //    Loop in pages of 500 — single .limit(500) without a loop would
  //    leave a permanent backlog if older history accumulates faster
  //    than we drain it. Cap iterations defensively.
  let deletedHistory = 0;
  for (let i = 0; i < 50; i++) {
    const page = await adminDb
      .collectionGroup("history")
      .where("changedAt", "<", historyCutoff)
      .limit(500)
      .get();
    if (page.empty) break;

    let batch = adminDb.batch();
    let inBatch = 0;
    for (const d of page.docs) {
      batch.delete(d.ref);
      inBatch++;
      deletedHistory++;
      if (inBatch >= 450) {
        await batch.commit();
        batch = adminDb.batch();
        inBatch = 0;
      }
    }
    if (inBatch > 0) await batch.commit();
    if (page.size < 500) break;
  }

  // 2. Cleanup phone rate-limit counters where every booking entry is
  //    older than 24h. The doc-id range query uses FieldPath.documentId()
  //    with DocumentReference bounds — the older `where("__name__", ...)`
  //    string form is ambiguous across SDK versions.
  const cutoff24hMs = subHours(new Date(), 24).getTime();
  const phoneCountersSnap = await adminDb
    .collection("counters")
    .where(FieldPath.documentId(), ">=", adminDb.doc("counters/phone_"))
    .where(FieldPath.documentId(), "<", adminDb.doc("counters/phone_~"))
    .limit(1000)
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
