"use server";

import { getAvailableSlots, getWorkingDays, getScheduleEndTimes } from "@/server/queries/slots";
import { getShopSettings } from "@/server/queries/settings";

export async function fetchSlots(
  barberId: string,
  serviceId: string,
  dateStr: string,
  excludeAppointmentId?: string
): Promise<string[]> {
  const settings = await getShopSettings();
  return getAvailableSlots(
    barberId,
    serviceId,
    dateStr,
    settings.slotIntervalMinutes,
    excludeAppointmentId
  );
}

export async function fetchWorkingDays(barberId: string): Promise<number[]> {
  return getWorkingDays(barberId);
}

export async function fetchScheduleEndTimes(
  barberId: string
): Promise<Record<number, string>> {
  return getScheduleEndTimes(barberId);
}
