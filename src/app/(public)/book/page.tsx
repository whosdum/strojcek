export const dynamic = "force-dynamic";

import { getCachedActiveServices, getCachedActiveBarbersWithServices } from "@/server/queries/cached";
import { BookingWizard } from "@/components/booking/booking-wizard";

export default async function BookingPage() {
  const [services, barbers] = await Promise.all([
    getCachedActiveServices(),
    getCachedActiveBarbersWithServices(),
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
