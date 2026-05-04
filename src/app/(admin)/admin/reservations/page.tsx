import Link from "next/link";
import { getAppointments } from "@/server/queries/appointments";
import { getAllBarbers } from "@/server/queries/barbers";
import { Badge } from "@/components/ui/badge";
import { BarberFilter } from "@/components/admin/barber-filter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/admin/clickable-table-row";
import { formatInTimeZone } from "date-fns-tz";
import { sk } from "date-fns/locale";
import { EyeIcon, ChevronRightIcon, PlusIcon, UserMinusIcon } from "lucide-react";
import type { AppointmentStatus } from "@/lib/types";
import {
  STATUS_LABELS,
  STATUS_VARIANTS,
  DATE_FORMAT,
  TIME_FORMAT,
  DATETIME_DAY_FORMAT,
  TIMEZONE,
} from "@/lib/constants";

type ViewMode = "upcoming" | "past" | "all";

const VIEW_LABELS: Record<ViewMode, string> = {
  upcoming: "Nadchádzajúce",
  past: "Predošlé",
  all: "Všetky",
};

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string;
    barberId?: string;
    status?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const cursor = params.cursor;
  const barberId = params.barberId || undefined;
  const status = params.status as AppointmentStatus | undefined;
  const view: ViewMode =
    params.view === "past" || params.view === "all" ? params.view : "upcoming";

  const [{ items, nextCursor }, allBarbers] = await Promise.all([
    getAppointments({ cursor, barberId, status, view }),
    getAllBarbers(),
  ]);

  const filtersQuery = new URLSearchParams();
  if (barberId) filtersQuery.set("barberId", barberId);
  if (status) filtersQuery.set("status", status);
  if (view !== "upcoming") filtersQuery.set("view", view);
  const filtersStr = filtersQuery.toString();
  const filtersSuffix = filtersStr ? `&${filtersStr}` : "";

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">Rezervácie</span>
      </nav>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Rezervácie</h1>
        <Link href="/admin/reservations/new" className="sm:w-auto">
          <Button className="w-full sm:w-auto">
            <PlusIcon className="mr-1 size-4" />
            Nová rezervácia
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <BarberFilter
          barbers={allBarbers.map((b) => ({
            id: b.id,
            label: `${b.firstName} ${b.lastName}`.trim(),
          }))}
          selected={barberId}
        />
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => {
            const qs = new URLSearchParams();
            if (barberId) qs.set("barberId", barberId);
            if (status) qs.set("status", status);
            if (v !== "upcoming") qs.set("view", v);
            const href = qs.toString()
              ? `/admin/reservations?${qs.toString()}`
              : "/admin/reservations";
            return (
              <Link key={v} href={href}>
                <Badge variant={view === v ? "default" : "outline"}>
                  {VIEW_LABELS[v]}
                </Badge>
              </Link>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
          <Link
            href={(() => {
              const qs = new URLSearchParams();
              if (barberId) qs.set("barberId", barberId);
              if (view !== "upcoming") qs.set("view", view);
              return qs.toString()
                ? `/admin/reservations?${qs.toString()}`
                : "/admin/reservations";
            })()}
          >
            <Badge variant={!status ? "default" : "outline"}>Všetky</Badge>
          </Link>
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const qs = new URLSearchParams();
            if (barberId) qs.set("barberId", barberId);
            qs.set("status", key);
            if (view !== "upcoming") qs.set("view", view);
            return (
              <Link key={key} href={`/admin/reservations?${qs.toString()}`}>
                <Badge variant={status === key ? "default" : "outline"}>
                  {label}
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((appt) => (
          <Link
            key={appt.id}
            href={`/admin/reservations/${appt.id}`}
            className="block rounded-xl border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 font-medium">
                  {appt.source === "walk-in" && (
                    <UserMinusIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-label="Walk-in"
                    />
                  )}
                  <span>{appt.customerName}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatInTimeZone(appt.startTime, TIMEZONE, DATETIME_DAY_FORMAT, { locale: sk })}
                </p>
              </div>
              <Badge variant={STATUS_VARIANTS[appt.status]}>
                {STATUS_LABELS[appt.status]}
              </Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>
                Barber: {appt.barber.firstName} {appt.barber.lastName}
              </p>
              <p>Služba: {appt.service.name}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dátum</TableHead>
              <TableHead>Čas</TableHead>
              <TableHead>Zákazník</TableHead>
              <TableHead>Barber</TableHead>
              <TableHead>Služba</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((appt) => (
              <ClickableTableRow
                key={appt.id}
                href={`/admin/reservations/${appt.id}`}
                ariaLabel={`Otvoriť rezerváciu ${appt.customerName ?? ""} ${formatInTimeZone(appt.startTime, TIMEZONE, DATE_FORMAT)}`.trim()}
              >
                <TableCell>
                  {formatInTimeZone(appt.startTime, TIMEZONE, DATE_FORMAT)}
                </TableCell>
                <TableCell>
                  {formatInTimeZone(appt.startTime, TIMEZONE, TIME_FORMAT)}
                </TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {appt.source === "walk-in" && (
                      <UserMinusIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-label="Walk-in"
                      />
                    )}
                    <span>{appt.customerName}</span>
                  </span>
                </TableCell>
                <TableCell>
                  {appt.barber.firstName} {appt.barber.lastName}
                </TableCell>
                <TableCell>{appt.service.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[appt.status]}>
                    {STATUS_LABELS[appt.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/reservations/${appt.id}`}
                    aria-label="Detail rezervácie"
                  >
                    <Button variant="ghost" size="icon-sm">
                      <EyeIcon className="size-4" />
                    </Button>
                  </Link>
                </TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — Firestore native cursor. Forward-only; use the
          browser back button to go back. The previous numbered-page UI
          required reading the entire collection and slicing in JS. */}
      {(cursor || nextCursor) && (
        <div className="mt-4 flex items-center justify-between gap-2">
          {cursor ? (
            <Link href={`/admin/reservations${filtersStr ? `?${filtersStr}` : ""}`}>
              <Button variant="outline" size="sm">
                Prvá strana
              </Button>
            </Link>
          ) : (
            <span />
          )}
          {nextCursor && (
            <Link href={`/admin/reservations?cursor=${nextCursor}${filtersSuffix}`}>
              <Button variant="outline" size="sm">
                Ďalšia
                <ChevronRightIcon className="ml-1 size-4" />
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
