import { prisma } from "@/server/lib/prisma";
import { hashToken } from "@/server/lib/tokens";

export async function getAppointmentByToken(rawToken: string) {
  const hashed = hashToken(rawToken);

  return prisma.appointment.findUnique({
    where: { cancellationToken: hashed },
    include: {
      barber: { select: { firstName: true, lastName: true } },
      service: { select: { name: true, durationMinutes: true, price: true } },
    },
  });
}
