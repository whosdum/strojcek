import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/lib/auth";
import { getAppointmentsForCalendar } from "@/server/queries/appointments";
import { adminDb } from "@/server/lib/firebase-admin";
import { countVisits } from "@/server/queries/visits";
import { parseISO } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");
  const rawBarberId = request.nextUrl.searchParams.get("barberId");
  const barberId = rawBarberId && UUID_RE.test(rawBarberId) ? rawBarberId : undefined;

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }

  const appointments = await getAppointmentsForCalendar(
    parseISO(start),
    parseISO(end),
    barberId
  );

  // Admin-only customer notes and visit counts aren't denormalized onto
  // appointments — batched reads for every distinct customer in range.
  const customerIds = [
    ...new Set(appointments.map((a) => a.customerId).filter((id): id is string => !!id)),
  ];
  const customerNotes = new Map<string, string>();
  let visitCounts = new Map<string, number>();
  if (customerIds.length > 0) {
    const [snaps, counts] = await Promise.all([
      adminDb.getAll(...customerIds.map((cid) => adminDb.doc(`customers/${cid}`))),
      countVisits(customerIds),
    ]);
    visitCounts = counts;
    for (const snap of snaps) {
      const notes = (snap.get("notes") as string | null | undefined)?.trim();
      if (notes) customerNotes.set(snap.id, notes);
    }
  }

  const events = appointments.map((appt) => {
    const isWalkIn = appt.source === "walk-in";
    const customer = appt.customerName?.trim() || (isWalkIn ? "Walk-in" : "");
    const title = isWalkIn
      ? customer
      : `${customer} — ${appt.service.name}`;
    const note = appt.notes?.trim() || null;
    return {
      id: appt.id,
      title,
      start: appt.startTime.toISOString(),
      end: appt.endTime.toISOString(),
      extendedProps: {
        barberId: appt.barberId,
        barberName: `${appt.barber.firstName} ${appt.barber.lastName}`,
        status: appt.status,
        source: appt.source,
        hasNote: note !== null,
        note,
        customerNote: appt.customerId ? customerNotes.get(appt.customerId) ?? null : null,
        visitCount: appt.customerId ? visitCounts.get(appt.customerId) ?? 0 : null,
      },
    };
  });

  return NextResponse.json(events);
}
