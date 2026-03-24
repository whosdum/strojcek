"use server";

import { getAvailableSlots, getBarberWorkingDays } from "@/server/queries/slots";
import { getShopSettings } from "@/server/queries/settings";

export async function fetchSlots(
  barberId: string,
  serviceId: string,
  dateStr: string
): Promise<string[]> {
  const settings = await getShopSettings();
  return getAvailableSlots(barberId, serviceId, dateStr, settings.slotIntervalMinutes);
}

export async function fetchWorkingDays(
  barberId: string
): Promise<number[]> {
  const days = await getBarberWorkingDays(barberId);
  return Array.from(days);
}
