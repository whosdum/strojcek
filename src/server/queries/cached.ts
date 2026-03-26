import { unstable_cache } from "next/cache";
import { prisma } from "@/server/lib/prisma";

/**
 * Cached queries for data that rarely changes (services, barbers, schedules).
 * Eliminates Neon cold-start latency for 95%+ of page loads.
 * Invalidated via updateTag() in mutation actions.
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
