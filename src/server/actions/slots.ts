"use server";

import {
  getAvailableSlots,
  getWorkingDays,
  getScheduleEndTimes,
  getAvailabilityBundle,
  type AvailabilityBundle,
} from "@/server/queries/slots";
import { getUpcomingOverrides } from "@/server/queries/barbers";
import { getShopSettings } from "@/server/queries/settings";
import { adminDb } from "@/server/lib/firebase-admin";
import type { BarberDoc } from "@/server/types/firestore";

const DEFAULT_BOOKING_HORIZON_WEEKS = 3;

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

/**
 * Returns upcoming overrides as a flat date→availability map for the
 * booking wizard's calendar matcher. An override may make a normally
 * non‑working day available (custom hours) or block a normally working
 * day (day off), so the calendar must consider it on top of the regular
 * weekly schedule.
 */
export async function fetchUpcomingOverrides(
  barberId: string
): Promise<Array<{ date: string; isAvailable: boolean }>> {
  const overrides = await getUpcomingOverrides(barberId);
  return overrides.map((o) => {
    // overrideDate is noon-local Date; format back to YYYY-MM-DD for matcher
    const y = o.overrideDate.getFullYear();
    const m = String(o.overrideDate.getMonth() + 1).padStart(2, "0");
    const d = String(o.overrideDate.getDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}`, isAvailable: o.isAvailable };
  });
}

/**
 * One-shot availability fetch for the booking wizard. Resolves the barber's
 * booking horizon, then returns the calendar disabled-state inputs plus a
 * pre-computed slot list for every date in the horizon — so a date click
 * needs no follow-up server round-trip.
 */
export async function fetchAvailability(
  barberId: string,
  serviceId: string
): Promise<AvailabilityBundle> {
  const [barberSnap, settings] = await Promise.all([
    adminDb.doc(`barbers/${barberId}`).get(),
    getShopSettings(),
  ]);
  const horizonWeeks = barberSnap.exists
    ? (barberSnap.data() as BarberDoc).bookingHorizonWeeks ??
      DEFAULT_BOOKING_HORIZON_WEEKS
    : DEFAULT_BOOKING_HORIZON_WEEKS;

  return getAvailabilityBundle(
    barberId,
    serviceId,
    horizonWeeks,
    settings.slotIntervalMinutes
  );
}
