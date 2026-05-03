import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { verifyCronAuth } from "@/server/lib/cron-auth";
import { hourKey } from "@/server/lib/firestore-utils";
import { subHours, subMonths } from "date-fns";

/**
 * Periodic cleanup:
 * 1. AppointmentStatusHistory subcollection entries older than 12 months
 * 2. Per-phone / per-email rate-limit counters where every booking entry is older than 24h
 * 3. Trim counters/global_bookings.hourly map of buckets older than 24h
 *
 * Firebase Auth sessions expire automatically, no cleanup needed.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  let phase: "history" | "counters" | "global" = "history";
  try {
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

    phase = "counters";

    // 2. Cleanup phone rate-limit counters where every booking entry is
    //    older than 24h. We scan the full `counters` collection and
    //    filter in-memory by id prefix — at this scale (~tens of phones,
    //    plus global_bookings + email_*) this is cheaper and more robust
    //    than a `__name__` range query, which has been flaky in past
    //    Firestore admin SDK versions.
    const cutoff24hMs = subHours(new Date(), 24).getTime();
    const allCountersSnap = await adminDb.collection("counters").get();

    let deletedCounters = 0;
    for (const d of allCountersSnap.docs) {
      if (!d.id.startsWith("phone_") && !d.id.startsWith("email_")) continue;
      const data = d.data() as { bookings?: Timestamp[] };
      const bookings = data.bookings ?? [];
      const allStale = bookings.every((t) => t.toMillis() < cutoff24hMs);
      if (allStale) {
        await d.ref.delete();
        deletedCounters++;
      }
    }

    phase = "global";

    // 3. Trim counters/global_bookings.hourly. The map grows once per
    //    hour of operation forever — booking.ts GC's it inline at write
    //    time but only when a write happens. A quiet day or rate-limit
    //    block prevents the inline GC from running, so the doc creeps
    //    toward Firestore's 1MiB cap. Belt-and-suspenders cleanup here.
    const globalRef = adminDb.doc("counters/global_bookings");
    const globalSnap = await globalRef.get();
    let trimmedHourlyKeys = 0;
    if (globalSnap.exists) {
      const hourly = (globalSnap.data() as {
        hourly?: Record<string, number>;
      }).hourly ?? {};
      const cutoffHourKey = hourKey(subHours(new Date(), 24));
      const trimmed: Record<string, number> = {};
      for (const [k, v] of Object.entries(hourly)) {
        if (k >= cutoffHourKey) trimmed[k] = v;
        else trimmedHourlyKeys++;
      }
      if (trimmedHourlyKeys > 0) {
        await globalRef.set({ hourly: trimmed });
      }
    }

    return NextResponse.json({
      ok: true,
      deletedHistory,
      deletedRateCounters: deletedCounters,
      trimmedHourlyKeys,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(`[cron/cleanup] Failed in phase=${phase}:`, err);
    return NextResponse.json(
      {
        ok: false,
        phase,
        error: err.message,
        name: err.name,
      },
      { status: 500 }
    );
  }
}
