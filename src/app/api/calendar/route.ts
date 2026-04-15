import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const title = searchParams.get("title") || "Strojček";
  const description = searchParams.get("description") || "";
  const location = searchParams.get("location") || "Moyzesova 379/2, 014 01 Bytča";

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }

  const toIcal = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Strojcek//Booking//SK",
    "BEGIN:VEVENT",
    `DTSTART:${toIcal(start)}`,
    `DTEND:${toIcal(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `LOCATION:${location.replace(/,/g, "\\,")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="strojcek-rezervacia.ics"',
    },
  });
}
