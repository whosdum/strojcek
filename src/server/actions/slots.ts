"use server";

import { getAvailableSlots } from "@/server/queries/slots";
import {
  getCachedShopSettings,
  getCachedWorkingDays,
  getCachedScheduleEndTimes,
} from "@/server/queries/cached";

export async function fetchSlots(
  barberId: string,
  serviceId: string,
  dateStr: string,
  excludeAppointmentId?: string
): Promise<string[]> {
  const settings = await getCachedShopSettings();
  return getAvailableSlots(
    barberId,
    serviceId,
    dateStr,
    settings.slotIntervalMinutes,
    excludeAppointmentId
  );
}

export async function fetchWorkingDays(
  barberId: string
): Promise<number[]> {
  return getCachedWorkingDays(barberId);
}

/** Returns a map of dayOfWeek → latest end time (e.g. { 1: "18:00", 2: "18:00" }) */
export async function fetchScheduleEndTimes(
  barberId: string
): Promise<Record<number, string>> {
  return getCachedScheduleEndTimes(barberId);
}
