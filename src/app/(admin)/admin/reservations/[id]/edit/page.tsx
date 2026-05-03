import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { AppointmentForm } from "@/components/admin/appointment-form";
import { getAppointmentById } from "@/server/queries/appointments";
import { getActiveServices } from "@/server/queries/services";
import { getActiveBarbersWithServices } from "@/server/queries/barbers";
import { TIMEZONE } from "@/lib/constants";

export default async function EditReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  if (appointment.status === "CANCELLED" || appointment.status === "NO_SHOW") {
    redirect(`/admin/reservations/${id}`);
  }

  const [services, barbers] = await Promise.all([
    getActiveServices(),
    getActiveBarbersWithServices(),
  ]);

  const localStart = toZonedTime(appointment.startTime, TIMEZONE);

  // Ensure the current barber/service appear in the dropdowns even if they
  // have since become inactive — admin needs to be able to load and adjust
  // the appointment.
  const serviceList = services.map((s) => ({ id: s.id, name: s.name }));
  if (!serviceList.some((s) => s.id === appointment.serviceId)) {
    serviceList.unshift({
      id: appointment.serviceId,
      name: `${appointment.service.name} (neaktívna)`,
    });
  }
  const barberList = barbers.map((b) => ({
    id: b.id,
    firstName: b.firstName,
    lastName: b.lastName,
    serviceIds: b.serviceIds,
  }));
  if (!barberList.some((b) => b.id === appointment.barberId)) {
    barberList.unshift({
      id: appointment.barberId,
      firstName: appointment.barber.firstName,
      lastName: `${appointment.barber.lastName} (neaktívny)`,
      serviceIds: [appointment.serviceId],
    });
  }

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin/reservations" className="hover:text-foreground">
          Rezervácie
        </Link>
        <span className="mx-1.5">/</span>
        <Link
          href={`/admin/reservations/${id}`}
          className="hover:text-foreground"
        >
          Detail
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">Upraviť</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Upraviť rezerváciu</h1>

      <div className="max-w-2xl">
        <AppointmentForm
          mode="edit"
          services={serviceList}
          barbers={barberList}
          initial={{
            id: appointment.id,
            barberId: appointment.barberId,
            serviceId: appointment.serviceId,
            date: format(localStart, "yyyy-MM-dd"),
            time: format(localStart, "HH:mm"),
            firstName: appointment.customer?.firstName ?? appointment.customerName?.split(" ")[0] ?? "",
            lastName:
              appointment.customer?.lastName ??
              appointment.customerName?.split(" ").slice(1).join(" ") ??
              "",
            phone: appointment.customer?.phone ?? appointment.customerPhone ?? "",
            email: appointment.customer?.email ?? appointment.customerEmail ?? "",
            notes: appointment.notes ?? "",
            priceFinal:
              appointment.priceFinal != null ? Number(appointment.priceFinal) : null,
            status: appointment.status,
            source: appointment.source,
            customerName: appointment.customerName,
          }}
        />
      </div>
    </div>
  );
}
