import { BookingSteps } from "@/components/booking/booking-steps";
import { ServiceCard } from "@/components/booking/service-card";
import { getActiveServices } from "@/server/queries/services";

export default async function BookingServicePage() {
  const services = await getActiveServices();

  return (
    <>
      <BookingSteps currentStep={1} />
      <h2 className="mb-4 text-lg font-semibold">Vyberte službu</h2>
      {services.length === 0 ? (
        <p className="text-center text-muted-foreground">
          Momentálne nie sú dostupné žiadne služby.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              id={service.id}
              name={service.name}
              description={service.description}
              durationMinutes={service.durationMinutes}
              price={service.price.toString()}
            />
          ))}
        </div>
      )}
    </>
  );
}
