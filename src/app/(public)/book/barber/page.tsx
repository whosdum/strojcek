import { redirect } from "next/navigation";
import { BookingSteps } from "@/components/booking/booking-steps";
import { BarberCard } from "@/components/booking/barber-card";
import { getBarbersByService } from "@/server/queries/barbers";

export default async function BookingBarberPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const { serviceId } = await searchParams;

  if (!serviceId) {
    redirect("/book");
  }

  const barbers = await getBarbersByService(serviceId);

  return (
    <>
      <BookingSteps currentStep={2} />
      <h2 className="mb-4 text-lg font-semibold">Vyberte barbiera</h2>
      {barbers.length === 0 ? (
        <p className="text-center text-muted-foreground">
          Pre vybranú službu nie sú dostupní žiadni barbieri.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {barbers.map((barber) => (
            <BarberCard
              key={barber.id}
              id={barber.id}
              firstName={barber.firstName}
              lastName={barber.lastName}
              bio={barber.bio}
              avatarUrl={barber.avatarUrl}
              serviceId={serviceId}
            />
          ))}
        </div>
      )}
    </>
  );
}
