import { prisma } from "@/server/lib/prisma";
import {
  getCachedScheduleOverride,
  getCachedSchedule,
  getCachedScheduleBreaks,
  getCachedBarberService,
} from "@/server/queries/cached";
import { SLOT_INTERVAL_MINUTES, TIMEZONE } from "@/lib/constants";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { addMinutes, isBefore, isAfter } from "date-fns";

interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Get available booking slots for a specific barber, service, and date.
 * Slots are computed dynamically — never stored in the database.
 *
 * All schedule times (workStart, workEnd, breaks) are interpreted as
 * Europe/Bratislava local times and converted to UTC for comparison
 * with appointment times stored in the database.
 *
 * @param slotInterval - optional interval in minutes (from ShopSettings); falls back to constant
 */
export async function getAvailableSlots(
  barberId: string,
  serviceId: string,
  dateStr: string, // YYYY-MM-DD
  slotInterval?: number,
  excludeAppointmentId?: string
): Promise<string[]> {
  const intervalMinutes = slotInterval ?? SLOT_INTERVAL_MINUTES;

  // Parse date as Bratislava midnight → UTC
  const dayStartUtc = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);

  // getDay() on the Bratislava-local date
  const localDate = toZonedTime(dayStartUtc, TIMEZONE);
  const dayOfWeek = localDate.getDay(); // 0=Sunday..6=Saturday

  // 1. Check schedule overrides (cached)
  const override = await getCachedScheduleOverride(barberId, dayStartUtc);

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
    // 2. Load regular schedule (cached)
    const schedule = await getCachedSchedule(barberId, dayOfWeek);
    if (!schedule) return []; // No schedule for this day
    workStart = schedule.startTime;
    workEnd = schedule.endTime;
  }

  // 3. Load breaks — only for regular days, not overrides (cached)
  let breaks: TimeRange[] = [];
  if (!isOverrideDay) {
    const scheduleBreaks = await getCachedScheduleBreaks(barberId, dayOfWeek);
    breaks = scheduleBreaks.map((b) => ({
      start: timeStringToUtc(dateStr, b.startTime),
      end: timeStringToUtc(dateStr, b.endTime),
    }));
  }

  // 4. Load active appointments — LIVE query (must be realtime)
  const appointments = await prisma.appointment.findMany({
    where: {
      barberId,
      startTime: { gte: dayStartUtc },
      endTime: { lte: dayEndUtc },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
    },
    include: {
      service: { select: { bufferMinutes: true } },
    },
  });

  const bookedRanges: TimeRange[] = appointments.map((a) => ({
    start: a.startTime,
    end: addMinutes(a.endTime, a.service.bufferMinutes),
  }));

  // 5. Get effective duration + buffer for the service being booked (cached)
  const barberService = await getCachedBarberService(barberId, serviceId);

  if (!barberService) return []; // Barber doesn't offer this service

  const service = barberService.service;
  const duration = barberService.customDuration ?? service.durationMinutes;
  const buffer = service.bufferMinutes;

  // 6. Generate candidates in SLOT_INTERVAL_MINUTES intervals
  const workingStartUtc = timeStringToUtc(dateStr, workStart);
  const workingEndUtc = timeStringToUtc(dateStr, workEnd);
  const nowUtc = new Date();

  const slots: string[] = [];
  let candidate = workingStartUtc;

  while (isBefore(candidate, workingEndUtc)) {
    const slotEnd = addMinutes(candidate, duration);
    const blockEnd = addMinutes(candidate, duration + buffer);

    // 7. Check all conditions
    const fitsInWorkingHours = !isAfter(slotEnd, workingEndUtc);
    const notInPast = isAfter(candidate, nowUtc);
    const noBreakOverlap = !breaks.some(
      (b) => isBefore(candidate, b.end) && isAfter(slotEnd, b.start)
    );
    const noAppointmentOverlap = !bookedRanges.some(
      (a) => isBefore(candidate, a.end) && isAfter(blockEnd, a.start)
    );

    if (fitsInWorkingHours && notInPast && noBreakOverlap && noAppointmentOverlap) {
      // Convert candidate UTC back to Bratislava local for display
      const local = toZonedTime(candidate, TIMEZONE);
      const hours = local.getHours().toString().padStart(2, "0");
      const mins = local.getMinutes().toString().padStart(2, "0");
      slots.push(`${hours}:${mins}`);
    }

    candidate = addMinutes(candidate, intervalMinutes);
  }

  return slots;
}

/** Convert a "HH:mm" time string on a given date to a UTC Date */
function timeStringToUtc(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, TIMEZONE);
}
