import { notFound } from "next/navigation";
import { getBarberById } from "@/server/queries/barbers";
import { getAllServices } from "@/server/queries/services";
import { BarberForm } from "@/components/admin/barber-form";
import Link from "next/link";

export default async function BarberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // "new" route handled here too
  if (id === "new") {
    const services = await getAllServices();
    return (
      <div>
        <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
          <span className="mx-1.5">/</span>
          <Link href="/admin/barbers" className="hover:text-foreground">Barberi</Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">Nový</span>
        </nav>
        <h1 className="mb-6 text-2xl font-bold">Nový barber</h1>
        <BarberForm
          allServices={services.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    );
  }

  const [barber, services] = await Promise.all([
    getBarberById(id),
    getAllServices(),
  ]);

  if (!barber) notFound();

  return (
    <div>
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin/barbers" className="hover:text-foreground">Barberi</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{barber.firstName} {barber.lastName}</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">
        Upraviť: {barber.firstName} {barber.lastName}
      </h1>
      <BarberForm
        barber={{
          ...barber,
          services: barber.services.map((s) => ({ serviceId: s.serviceId })),
        }}
        allServices={services.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
