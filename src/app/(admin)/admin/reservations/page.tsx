import Link from "next/link";
import { getAppointments } from "@/server/queries/appointments";
import { getActiveBarbers } from "@/server/queries/barbers";
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
import { EyeIcon } from "lucide-react";
import { AppointmentStatus } from "@/generated/prisma/client";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čaká",
  CONFIRMED: "Potvrdená",
  IN_PROGRESS: "Prebieha",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
  NO_SHOW: "Neprišiel",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "default",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

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
  const barberId = params.barberId;
  const status = params.status as AppointmentStatus | undefined;

  const [{ items, total, pages }, barbers] = await Promise.all([
    getAppointments({ page, barberId, status }),
    getActiveBarbers(),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Rezervácie</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dátum</TableHead>
            <TableHead>Čas</TableHead>
            <TableHead>Zákazník</TableHead>
            <TableHead>Barbier</TableHead>
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

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
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
        </div>
      )}
    </div>
  );
}
