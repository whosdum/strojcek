import { prisma } from "@/server/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";
import { AppointmentStatus } from "@/generated/prisma/client";

export async function getTodayAppointments() {
  const today = startOfDay(new Date());
  const tomorrow = endOfDay(today);

  return prisma.appointment.findMany({
    where: {
      startTime: { gte: today, lte: tomorrow },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: {
      barber: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getUpcomingAppointments(limit = 5) {
  return prisma.appointment.findMany({
    where: {
      startTime: { gte: new Date() },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: {
      barber: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
    take: limit,
  });
}

interface GetAppointmentsParams {
  page?: number;
  barberId?: string;
  status?: AppointmentStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function getAppointments({
  page = 1,
  barberId,
  status,
  dateFrom,
  dateTo,
}: GetAppointmentsParams = {}) {
  const where: Record<string, unknown> = {};
  if (barberId) where.barberId = barberId;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.startTime = {
      ...(dateFrom && { gte: dateFrom }),
      ...(dateTo && { lte: endOfDay(dateTo) }),
    };
  }

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        barber: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
      orderBy: { startTime: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { items, total, pages: Math.ceil(total / PAGE_SIZE) };
}

export async function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: {
      barber: true,
      service: true,
      customer: true,
      statusHistory: { orderBy: { changedAt: "desc" } },
    },
  });
}

export async function getAppointmentsForCalendar(
  startDate: Date,
  endDate: Date,
  barberId?: string
) {
  return prisma.appointment.findMany({
    where: {
      startTime: { gte: startDate },
      endTime: { lte: endDate },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      ...(barberId && { barberId }),
    },
    include: {
      barber: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getDayStats(date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [total, completed, noShow] = await Promise.all([
    prisma.appointment.count({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["CANCELLED"] },
      },
    }),
    prisma.appointment.count({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        status: "COMPLETED",
      },
    }),
    prisma.appointment.count({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        status: "NO_SHOW",
      },
    }),
  ]);

  return { total, completed, noShow, noShowRate: total > 0 ? noShow / total : 0 };
}

const REVENUE_WHERE = {
  status: { notIn: ["CANCELLED", "NO_SHOW"] as AppointmentStatus[] },
};

async function sumRevenue(gte: Date, lte: Date): Promise<number> {
  const result = await prisma.appointment.aggregate({
    _sum: { priceExpected: true },
    where: {
      ...REVENUE_WHERE,
      startTime: { gte, lte },
    },
  });
  return Number(result._sum.priceExpected ?? 0);
}

export async function getRevenueStats() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const [today, week, month] = await Promise.all([
    sumRevenue(todayStart, todayEnd),
    sumRevenue(weekStart, todayEnd),
    sumRevenue(monthStart, todayEnd),
  ]);

  return { today, week, month };
}

export async function getServicePopularity(limit = 5) {
  const monthStart = startOfMonth(new Date());

  const grouped = await prisma.appointment.groupBy({
    by: ["serviceId"],
    _count: { id: true },
    _sum: { priceExpected: true },
    where: {
      ...REVENUE_WHERE,
      startTime: { gte: monthStart },
    },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  const serviceIds = grouped.map((g) => g.serviceId);
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });

  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  return grouped.map((g) => ({
    serviceName: serviceMap.get(g.serviceId) ?? "Neznáma",
    count: g._count.id,
    revenue: Number(g._sum.priceExpected ?? 0),
  }));
}
