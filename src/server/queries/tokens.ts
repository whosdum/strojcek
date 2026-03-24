import { prisma } from "@/server/lib/prisma";
import { getTokenLookupValues } from "@/server/lib/tokens";

export async function getAppointmentByToken(rawToken: string) {
  const [primaryToken, fallbackToken] = getTokenLookupValues(rawToken);

  const appointment = await prisma.appointment.findUnique({
    where: { cancellationToken: primaryToken },
    include: {
      barber: { select: { firstName: true, lastName: true } },
      service: { select: { name: true, durationMinutes: true, price: true } },
    },
  });

  if (appointment || !fallbackToken) {
    return appointment;
  }

  return prisma.appointment.findUnique({
    where: { cancellationToken: fallbackToken },
    include: {
      barber: { select: { firstName: true, lastName: true } },
      service: { select: { name: true, durationMinutes: true, price: true } },
    },
  });
}
