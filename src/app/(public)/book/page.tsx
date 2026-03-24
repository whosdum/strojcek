import { getActiveServices } from "@/server/queries/services";
import { getActiveBarbersWithServices } from "@/server/queries/barbers";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const [services, barbers] = await Promise.all([
    getActiveServices(),
    getActiveBarbersWithServices(),
  ]);

  const serializedServices = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    price: s.price.toString(),
  }));

  return <BookingWizard services={serializedServices} barbers={barbers} />;
}
