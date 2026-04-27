import Link from "next/link";
import { AppointmentForm } from "@/components/admin/appointment-form";
import { getActiveServices } from "@/server/queries/services";
import { getActiveBarbersWithServices } from "@/server/queries/barbers";

export default async function NewReservationPage() {
  const [services, barbers] = await Promise.all([
    getActiveServices(),
    getActiveBarbersWithServices(),
  ]);

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin/reservations" className="hover:text-foreground">
          Rezervácie
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Nová</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Nová rezervácia</h1>

      <div className="max-w-2xl">
        <AppointmentForm
          mode="create"
          services={services.map((s) => ({ id: s.id, name: s.name }))}
          barbers={barbers}
        />
      </div>
    </div>
  );
}
