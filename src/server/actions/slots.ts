"use server";

import { getAvailableSlots } from "@/server/queries/slots";
import {
  getCachedShopSettings,
  getCachedWorkingDays,
} from "@/server/queries/cached";

export async function fetchSlots(
  barberId: string,
  serviceId: string,
  dateStr: string
): Promise<string[]> {
  const settings = await getCachedShopSettings();
  return getAvailableSlots(barberId, serviceId, dateStr, settings.slotIntervalMinutes);
}

export async function fetchWorkingDays(
  barberId: string
): Promise<number[]> {
  return getCachedWorkingDays(barberId);
}
