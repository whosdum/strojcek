import Link from "next/link";
import { getAppointments } from "@/server/queries/appointments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { EyeIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { AppointmentStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/constants";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    barberId?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const barberId = params.barberId || undefined;
  const status = params.status as AppointmentStatus | undefined;

  const { items, pages } = await getAppointments({ page, barberId, status });

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Rezervácie</span>
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
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
        <Link href="/admin/reservations">
          <Badge variant={!status ? "default" : "outline"}>Všetky</Badge>
        </Link>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <Link key={key} href={`/admin/reservations?status=${key}`}>
            <Badge variant={status === key ? "default" : "outline"}>
              {label}
            </Badge>
          </Link>
        ))}
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
                <p className="font-medium">{appt.customerName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {format(appt.startTime, "EEEE d.M. HH:mm", { locale: sk })}
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
              <TableRow key={appt.id}>
                <TableCell>
                  {format(appt.startTime, "d.M.yyyy")}
                </TableCell>
                <TableCell>
                  {format(appt.startTime, "HH:mm")}
                </TableCell>
                <TableCell className="font-medium">
                  {appt.customerName}
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
                  <Link href={`/admin/reservations/${appt.id}`}>
                    <Button variant="ghost" size="icon-sm">
                      <EyeIcon className="size-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            href={`/admin/reservations?page=${Math.max(1, page - 1)}${status ? `&status=${status}` : ""}`}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          >
            <Button variant="outline" size="sm">
              <ChevronLeftIcon className="size-4" />
            </Button>
          </Link>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/reservations?page=${p}${status ? `&status=${status}` : ""}`}
            >
              <Button
                variant={p === page ? "default" : "outline"}
                size="sm"
              >
                {p}
              </Button>
            </Link>
          ))}
          <Link
            href={`/admin/reservations?page=${Math.min(pages, page + 1)}${status ? `&status=${status}` : ""}`}
            aria-disabled={page >= pages}
            className={page >= pages ? "pointer-events-none opacity-50" : ""}
          >
            <Button variant="outline" size="sm">
              <ChevronRightIcon className="size-4" />
            </Button>
          </Link>
          <span className="ml-2 text-xs text-muted-foreground">
            Strana {page} z {pages}
          </span>
        </div>
      )}
    </div>
  );
}
