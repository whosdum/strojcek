import { notFound } from "next/navigation";
import { getAppointmentById } from "@/server/queries/appointments";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { StatusActions } from "@/components/admin/status-actions";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { AppointmentDeleteButton } from "@/components/admin/appointment-delete-button";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čaká",
  CONFIRMED: "Potvrdená",
  IN_PROGRESS: "Prebieha",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
  NO_SHOW: "Neprišiel",
};

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appointment = await getAppointmentById(id);

  if (!appointment) notFound();

  return (
    <div>
      <Link href="/admin/reservations" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Späť na zoznam
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Detail rezervácie</h1>
        <AppointmentDeleteButton appointmentId={appointment.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informácie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Zákazník</span>
              {appointment.customerId ? (
                <Link
                  href={`/admin/customers/${appointment.customerId}`}
                  className="break-words font-medium hover:underline sm:text-right"
                >
                  {appointment.customerName}
                </Link>
              ) : (
                <span className="break-words font-medium sm:text-right">
                  {appointment.customerName}
                </span>
              )}
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Telefón</span>
              <span className="break-words sm:text-right">
                {appointment.customerPhone}
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="break-words sm:text-right">
                {appointment.customerEmail || "—"}
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Služba</span>
              <span className="break-words font-medium sm:text-right">
                {appointment.service.name}
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Barbier</span>
              <span className="break-words sm:text-right">
                {appointment.barber.firstName} {appointment.barber.lastName}
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Dátum</span>
              <span className="break-words sm:text-right">
                {format(appointment.startTime, "EEEE, d. MMMM yyyy", {
                  locale: sk,
                })}
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Čas</span>
              <span className="sm:text-right">
                {format(appointment.startTime, "HH:mm")} —{" "}
                {format(appointment.endTime, "HH:mm")}
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Cena</span>
              <span className="font-medium">
                {appointment.priceExpected.toString()} €
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Zdroj</span>
              <span className="break-words sm:text-right">{appointment.source}</span>
            </div>
            {appointment.notes && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">Poznámka:</span>
                  <p className="mt-1">{appointment.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stav</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="mb-4 text-base">
                {STATUS_LABELS[appointment.status]}
              </Badge>
              <StatusActions
                appointmentId={appointment.id}
                currentStatus={appointment.status}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>História stavov</CardTitle>
            </CardHeader>
            <CardContent>
              {appointment.statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žiadna história.</p>
              ) : (
                <div className="space-y-2">
                  {appointment.statusHistory.map((h) => (
                    <div
                      key={h.id}
                      className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <span className="text-muted-foreground">
                          {h.oldStatus ?? "—"}
                        </span>
                        <span className="mx-1">→</span>
                        <span className="font-medium">
                          {STATUS_LABELS[h.newStatus] ?? h.newStatus}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(h.changedAt, "d.M. HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
