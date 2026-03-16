import { prisma } from "@/server/lib/prisma";

export async function getActiveBarbers() {
  return prisma.barber.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getBarbersByService(serviceId: string) {
  return prisma.barber.findMany({
    where: {
      isActive: true,
      services: { some: { serviceId } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAllBarbers() {
  return prisma.barber.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      services: { include: { service: true } },
    },
  });
}

export async function getBarberById(id: string) {
  return prisma.barber.findUnique({
    where: { id },
    include: {
      services: { include: { service: true } },
      schedules: { orderBy: { dayOfWeek: "asc" } },
      scheduleBreaks: { orderBy: { dayOfWeek: "asc" } },
    },
  });
}
