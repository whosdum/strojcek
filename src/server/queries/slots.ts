import { prisma } from "@/server/lib/prisma";
import { SLOT_INTERVAL_MINUTES, TIMEZONE } from "@/lib/constants";
import { toZonedTime } from "date-fns-tz";
import {
  startOfDay,
  addMinutes,
  setHours,
  setMinutes,
  isBefore,
  isAfter,
  parseISO,
} from "date-fns";

interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Get available booking slots for a specific barber, service, and date.
 * Slots are computed dynamically — never stored in the database.
 * @param slotInterval - optional interval in minutes (from ShopSettings); falls back to constant
 */
export async function getAvailableSlots(
  barberId: string,
  serviceId: string,
  dateStr: string, // YYYY-MM-DD
  slotInterval?: number
): Promise<string[]> {
  const intervalMinutes = slotInterval ?? SLOT_INTERVAL_MINUTES;
  const date = parseISO(dateStr);
  const dayOfWeek = date.getDay(); // 0=Sunday..6=Saturday

  // 1. Check schedule overrides
  const override = await prisma.scheduleOverride.findUnique({
    where: {
      barberId_overrideDate: {
        barberId,
        overrideDate: startOfDay(date),
      },
    },
  });

  let workStart: string;
  let workEnd: string;
  let isOverrideDay = false;

  if (override) {
    if (!override.isAvailable) return []; // Day off
    if (!override.startTime || !override.endTime) return [];
    workStart = override.startTime;
    workEnd = override.endTime;
    isOverrideDay = true;
  } else {
    // 2. Load regular schedule
    const schedule = await prisma.schedule.findFirst({
      where: { barberId, dayOfWeek, isActive: true },
    });
    if (!schedule) return []; // No schedule for this day
    workStart = schedule.startTime;
    workEnd = schedule.endTime;
  }

  // 3. Load breaks (only for regular days, not overrides)
  let breaks: TimeRange[] = [];
  if (!isOverrideDay) {
    const scheduleBreaks = await prisma.scheduleBreak.findMany({
      where: { barberId, dayOfWeek },
    });
    breaks = scheduleBreaks.map((b) => ({
      start: timeStringToDate(date, b.startTime),
      end: timeStringToDate(date, b.endTime),
    }));
  }

  // 4. Load active appointments with their service buffer
  const dayStart = startOfDay(date);
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const appointments = await prisma.appointment.findMany({
    where: {
      barberId,
      startTime: { gte: dayStart },
      endTime: { lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    include: {
      service: { select: { bufferMinutes: true } },
    },
  });

  const bookedRanges: TimeRange[] = appointments.map((a) => ({
    start: a.startTime,
    end: addMinutes(a.endTime, a.service.bufferMinutes),
  }));

  // 5. Get effective duration + buffer for the service being booked
  const barberService = await prisma.barberService.findUnique({
    where: { barberId_serviceId: { barberId, serviceId } },
    include: { service: true },
  });

  if (!barberService) return []; // Barber doesn't offer this service

  const service = barberService.service;
  const duration = barberService.customDuration ?? service.durationMinutes;
  const buffer = service.bufferMinutes;

  // 6. Generate candidates in SLOT_INTERVAL_MINUTES intervals
  const workingStart = timeStringToDate(date, workStart);
  const workingEnd = timeStringToDate(date, workEnd);
  const now = toZonedTime(new Date(), TIMEZONE);

  const slots: string[] = [];
  let candidate = workingStart;

  while (isBefore(candidate, workingEnd)) {
    const slotEnd = addMinutes(candidate, duration);
    const blockEnd = addMinutes(candidate, duration + buffer);

    // 7. Check all conditions
    const fitsInWorkingHours = !isAfter(slotEnd, workingEnd);
    const notInPast = isAfter(candidate, now);
    const noBreakOverlap = !breaks.some(
      (b) => isBefore(candidate, b.end) && isAfter(slotEnd, b.start)
    );
    const noAppointmentOverlap = !bookedRanges.some(
      (a) => isBefore(candidate, a.end) && isAfter(blockEnd, a.start)
    );

    if (fitsInWorkingHours && notInPast && noBreakOverlap && noAppointmentOverlap) {
      const hours = candidate.getHours().toString().padStart(2, "0");
      const mins = candidate.getMinutes().toString().padStart(2, "0");
      slots.push(`${hours}:${mins}`);
    }

    candidate = addMinutes(candidate, intervalMinutes);
  }

  return slots;
}

/**
 * Get dates where a barber works within a date range (for calendar disabled days).
 */
export async function getBarberWorkingDays(
  barberId: string
): Promise<Set<number>> {
  const schedules = await prisma.schedule.findMany({
    where: { barberId, isActive: true },
    select: { dayOfWeek: true },
  });

  return new Set(schedules.map((s) => s.dayOfWeek));
}

function timeStringToDate(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return setMinutes(setHours(startOfDay(date), hours), minutes);
}
