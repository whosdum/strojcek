import { NextRequest, NextResponse } from "next/server";
import { getAppointmentsForCalendar } from "@/server/queries/appointments";
import { parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");
  const barberId = request.nextUrl.searchParams.get("barberId") || undefined;

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
