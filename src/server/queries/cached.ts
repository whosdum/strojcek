import { unstable_cache } from "next/cache";
import { prisma } from "@/server/lib/prisma";

/**
 * Cached queries for data that rarely changes (services, barbers, schedules).
 * Eliminates Neon cold-start latency for 95%+ of page loads.
 * Invalidated via revalidateTag() in mutation actions.
 */

// ─── Services ────────────────────────────────────────────────────────
export const getCachedActiveServices = unstable_cache(
  async () => {
    return prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },
  ["active-services"],
  { tags: ["services"], revalidate: 3600 }
);

// ─── Barbers ─────────────────────────────────────────────────────────
export const getCachedActiveBarbersWithServices = unstable_cache(
  async () => {
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
  },
  ["active-barbers-with-services"],
  { tags: ["barbers"], revalidate: 3600 }
);

export const getCachedAllBarbersWithSchedules = unstable_cache(
  async () => {
    return prisma.barber.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        schedules: { orderBy: { dayOfWeek: "asc" } },
        scheduleBreaks: { orderBy: { dayOfWeek: "asc" } },
      },
    });
  },
  ["all-barbers-with-schedules"],
  { tags: ["barbers", "schedules"], revalidate: 3600 }
);

// ─── Shop Settings ───────────────────────────────────────────────────
export const getCachedShopSettings = unstable_cache(
  async () => {
    const settings = await prisma.shopSettings.findFirst();
    if (settings) return settings;
    return prisma.shopSettings.create({
      data: { slotIntervalMinutes: 60 },
    });
  },
  ["shop-settings"],
  { tags: ["settings"], revalidate: 86400 }
);

// ─── Working Days per Barber ─────────────────────────────────────────
export function getCachedWorkingDays(barberId: string) {
  return unstable_cache(
    async () => {
      const schedules = await prisma.schedule.findMany({
        where: { barberId, isActive: true },
        select: { dayOfWeek: true },
      });
      return schedules.map((s) => s.dayOfWeek);
    },
    [`working-days-${barberId}`],
    { tags: ["schedules"], revalidate: 3600 }
  )();
}

// ─── Schedule for a Barber + Day ─────────────────────────────────────
export function getCachedSchedule(barberId: string, dayOfWeek: number) {
  return unstable_cache(
    async () => {
      return prisma.schedule.findFirst({
        where: { barberId, dayOfWeek, isActive: true },
      });
    },
    [`schedule-${barberId}-${dayOfWeek}`],
    { tags: ["schedules"], revalidate: 3600 }
  )();
}

// ─── Schedule Breaks for a Barber + Day ──────────────────────────────
export function getCachedScheduleBreaks(barberId: string, dayOfWeek: number) {
  return unstable_cache(
    async () => {
      return prisma.scheduleBreak.findMany({
        where: { barberId, dayOfWeek },
      });
    },
    [`schedule-breaks-${barberId}-${dayOfWeek}`],
    { tags: ["schedules"], revalidate: 3600 }
  )();
}

// ─── Schedule Override for a Barber + Date ───────────────────────────
export function getCachedScheduleOverride(barberId: string, overrideDate: Date) {
  const dateKey = overrideDate.toISOString().split("T")[0];
  return unstable_cache(
    async () => {
      return prisma.scheduleOverride.findUnique({
        where: {
          barberId_overrideDate: { barberId, overrideDate },
        },
      });
    },
    [`schedule-override-${barberId}-${dateKey}`],
    { tags: ["schedules"], revalidate: 3600 }
  )();
}

// ─── Barber Service (duration + buffer) ──────────────────────────────
export function getCachedBarberService(barberId: string, serviceId: string) {
  return unstable_cache(
    async () => {
      return prisma.barberService.findUnique({
        where: { barberId_serviceId: { barberId, serviceId } },
        include: { service: true },
      });
    },
    [`barber-service-${barberId}-${serviceId}`],
    { tags: ["barbers", "services"], revalidate: 3600 }
  )();
}
