"use server";

import { getAvailableSlots, getBarberWorkingDays } from "@/server/queries/slots";

export async function fetchSlots(
  barberId: string,
  serviceId: string,
  dateStr: string
): Promise<string[]> {
  return getAvailableSlots(barberId, serviceId, dateStr);
}

export async function fetchWorkingDays(
  barberId: string
): Promise<number[]> {
  const now = new Date();
  const days = await getBarberWorkingDays(barberId, now, now);
  return Array.from(days);
}
