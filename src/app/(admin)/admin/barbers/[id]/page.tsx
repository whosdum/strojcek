import { notFound } from "next/navigation";
import { getBarberById } from "@/server/queries/barbers";
import { getAllServices } from "@/server/queries/services";
import { BarberForm } from "@/components/admin/barber-form";

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
