import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/lib/auth";
import { getAppointmentsForExport } from "@/server/queries/appointments";
import { getAllCustomersForExport } from "@/server/queries/customers";
import { buildCsv } from "@/server/lib/csv";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  TIMEZONE,
  DATE_FORMAT,
  TIME_FORMAT,
  DATETIME_FORMAT,
  STATUS_LABELS,
  SOURCE_LABELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Euros as a plain decimal-comma number (e.g. 19 -> "19,00"), Excel-friendly. */
function money(euros: number): string {
  return euros.toFixed(2).replace(".", ",");
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");

  if (type === "customers") {
    const customers = await getAllCustomersForExport();
    const headers = [
      "Meno",
      "Telefón",
      "E-mail",
      "Počet návštev",
      "Poznámka",
      "Vytvorené",
      "ID",
    ];
    const rows = customers.map((c) => [
      `${c.firstName} ${c.lastName ?? ""}`.trim(),
      c.phone,
      c.email ?? "",
      c.visitCount,
      c.notes ?? "",
      formatInTimeZone(c.createdAt, TIMEZONE, DATETIME_FORMAT),
      c.id,
    ]);
    const today = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
    return csvResponse(buildCsv(headers, rows), `zakaznici_${today}.csv`);
  }

  if (type === "reservations") {
    const todayKey = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
    const fromStr =
      request.nextUrl.searchParams.get("from") ?? `${todayKey.slice(0, 8)}01`;
    const toStr = request.nextUrl.searchParams.get("to") ?? todayKey;

    if (!YMD_RE.test(fromStr) || !YMD_RE.test(toStr)) {
      return NextResponse.json(
        { error: "Neplatný dátum (formát YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Lexicographic compare is exact for YYYY-MM-DD and catches reversed ranges
    // reliably. A prior numeric span check rounded a one-day reversal to -0
    // (and -0 < 0 is false), letting it through as an empty 200 file.
    if (fromStr > toStr) {
      return NextResponse.json(
        { error: "Dátum 'od' je po dátume 'do'" },
        { status: 400 }
      );
    }

    // Interpret the day boundaries in Bratislava local time, then convert to
    // the UTC instants Firestore stores.
    const startDate = fromZonedTime(`${fromStr}T00:00:00`, TIMEZONE);
    const endDate = fromZonedTime(`${toStr}T23:59:59.999`, TIMEZONE);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Neplatný dátum" }, { status: 400 });
    }

    const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
    if (spanDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: "Rozsah presahuje 366 dní" },
        { status: 400 }
      );
    }

    const appts = await getAppointmentsForExport(startDate, endDate);
    const headers = [
      "Dátum",
      "Čas od",
      "Čas do",
      "Holič",
      "Služba",
      "Zákazník",
      "Telefón",
      "E-mail",
      "Cena (€)",
      "Stav",
      "Zdroj",
      "Poznámka",
      "Vytvorené",
      "ID",
    ];
    const rows = appts.map((a) => [
      formatInTimeZone(a.startTime, TIMEZONE, DATE_FORMAT),
      formatInTimeZone(a.startTime, TIMEZONE, TIME_FORMAT),
      formatInTimeZone(a.endTime, TIMEZONE, TIME_FORMAT),
      `${a.barber.firstName} ${a.barber.lastName}`.trim(),
      a.service.name,
      a.customerName ?? "",
      a.customerPhone ?? "",
      a.customerEmail ?? "",
      money(a.priceFinal ?? a.priceExpected),
      STATUS_LABELS[a.status] ?? a.status,
      SOURCE_LABELS[a.source] ?? a.source,
      a.notes ?? "",
      formatInTimeZone(a.createdAt, TIMEZONE, DATETIME_FORMAT),
      a.id,
    ]);
    return csvResponse(buildCsv(headers, rows), `rezervacie_${fromStr}_${toStr}.csv`);
  }

  return NextResponse.json(
    { error: "Neznámy typ exportu (použi type=reservations|customers)" },
    { status: 400 }
  );
}
