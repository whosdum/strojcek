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

export async function getAllBarbersWithSchedules() {
  return prisma.barber.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      schedules: { orderBy: { dayOfWeek: "asc" } },
      scheduleBreaks: { orderBy: { dayOfWeek: "asc" } },
    },
  });
}

export async function getActiveBarbersWithServices() {
  const barbers = await prisma.barber.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      services: { select: { serviceId: true } },
    },
  });
  return barbers.map((b) => ({
    id: b.id,
    firstName: b.firstName,
    lastName: b.lastName,
    bio: b.bio,
    avatarUrl: b.avatarUrl,
    serviceIds: b.services.map((s) => s.serviceId),
  }));
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
