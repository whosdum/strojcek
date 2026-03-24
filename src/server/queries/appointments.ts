import { prisma } from "@/server/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { startOfDay, endOfDay } from "date-fns";
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
