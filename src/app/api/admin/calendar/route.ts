import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/lib/auth";
import { getAppointmentsForCalendar } from "@/server/queries/appointments";
import { parseISO } from "date-fns";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  // Auth check — only logged-in admin users
  const session = await auth.api.getSession({
    headers: request.headers,
  });

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

  const events = appointments.map((appt) => ({
    id: appt.id,
    title: `${appt.barber.firstName} — ${appt.service.name} — ${appt.customerName}`,
    start: appt.startTime.toISOString(),
    end: appt.endTime.toISOString(),
    extendedProps: {
      barberId: appt.barberId,
      barberName: `${appt.barber.firstName} ${appt.barber.lastName}`,
      status: appt.status,
    },
  }));

  return NextResponse.json(events);
}
