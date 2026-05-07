import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { tsToDate } from "@/server/lib/firestore-utils";
import { SLOT_INTERVAL_MINUTES, TIMEZONE } from "@/lib/constants";
import { MIN_BOOKING_LEAD_MINUTES } from "@/lib/business-info";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { addMinutes, isBefore, isAfter, addDays, format } from "date-fns";
import type {
  AppointmentDoc,
  ScheduleDoc,
  ScheduleBreakDoc,
  ScheduleOverrideDoc,
  BarberServiceDoc,
} from "@/server/types/firestore";

interface TimeRange {
  start: Date;
  end: Date;
}

export async function getAvailableSlots(
  barberId: string,
  serviceId: string,
  dateStr: string,
  slotInterval?: number,
  excludeAppointmentId?: string
): Promise<string[]> {
  const intervalMinutes = slotInterval ?? SLOT_INTERVAL_MINUTES;

  const dayStartUtc = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);
  const localDate = toZonedTime(dayStartUtc, TIMEZONE);
  const dayOfWeek = localDate.getDay();

  // Reads 1, 2, 3, 4 are independent — fan them out in parallel. Saves
  // roughly 100-300ms of latency per slot fetch (the booking wizard
  // calls this on every date change, so it adds up).
  const [overrideSnap, breaksSnap, apptsSnap, bsSnap] = await Promise.all([
    adminDb.doc(`barbers/${barberId}/overrides/${dateStr}`).get(),
    adminDb
      .collection(`barbers/${barberId}/breaks`)
      .where("dayOfWeek", "==", dayOfWeek)
      .get(),
    adminDb
      .collection("appointments")
      .where("barberId", "==", barberId)
      .where("startTime", ">=", Timestamp.fromDate(dayStartUtc))
      .where("startTime", "<", Timestamp.fromDate(dayEndUtc))
      .get(),
    adminDb.doc(`barbers/${barberId}/services/${serviceId}`).get(),
  ]);

  let workStart: string;
  let workEnd: string;
  let isOverrideDay = false;

  if (overrideSnap.exists) {
    const o = overrideSnap.data() as ScheduleOverrideDoc;
    if (!o.isAvailable || !o.startTime || !o.endTime) return [];
    workStart = o.startTime;
    workEnd = o.endTime;
    isOverrideDay = true;
  } else {
    // Schedule is only needed when there's no override — sequential read
    // here is fine, the common path (override absent) does one extra
    // round-trip rather than always paying for it.
    const scheduleSnap = await adminDb
      .doc(`barbers/${barberId}/schedules/${dayOfWeek}`)
      .get();
    if (!scheduleSnap.exists) return [];
    const s = scheduleSnap.data() as ScheduleDoc;
    if (!s.isActive) return [];
    workStart = s.startTime;
    workEnd = s.endTime;
  }

  // 2. Breaks (regular days only)
  const breaks: TimeRange[] = isOverrideDay
    ? []
    : breaksSnap.docs.map((d) => {
        const b = d.data() as ScheduleBreakDoc;
        return {
          start: fromZonedTime(`${dateStr}T${b.startTime}:00`, TIMEZONE),
          end: fromZonedTime(`${dateStr}T${b.endTime}:00`, TIMEZONE),
        };
      });

  // 3. Live appointments
  const bookedRanges: TimeRange[] = apptsSnap.docs
    .filter((d) => d.id !== excludeAppointmentId)
    .map((d) => d.data() as AppointmentDoc)
    .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
    .map((a) => ({
      start: tsToDate(a.startTime),
      end: addMinutes(tsToDate(a.endTime), a.serviceBufferMinutes ?? 0),
    }));

  // 4. Barber service (duration + buffer)
  if (!bsSnap.exists) return [];
  const bs = bsSnap.data() as BarberServiceDoc;
  const duration = bs.customDuration ?? bs.defaultDuration;
  const buffer = bs.bufferMinutes;

  // 5. Generate candidates
  const workingStartUtc = fromZonedTime(`${dateStr}T${workStart}:00`, TIMEZONE);
  const workingEndUtc = fromZonedTime(`${dateStr}T${workEnd}:00`, TIMEZONE);
  const nowUtc = new Date();

  // Customers need lead time to actually arrive — never offer a slot
  // that starts within MIN_BOOKING_LEAD_MINUTES from now.
  const earliestStartMs = nowUtc.getTime() + MIN_BOOKING_LEAD_MINUTES * 60_000;

  const slots: string[] = [];
  let candidate = workingStartUtc;
  while (isBefore(candidate, workingEndUtc)) {
    const slotEnd = addMinutes(candidate, duration);
    const blockEnd = addMinutes(candidate, duration + buffer);

    const fitsInWorkingHours = !isAfter(slotEnd, workingEndUtc);
    const notInPast = candidate.getTime() >= earliestStartMs;
    // A slot whose post-service buffer extends into a break shouldn't be
    // offered — the booking transaction wouldn't notice (it only checks
    // appointment overlap), and the customer would arrive to find the
    // barber already on a scheduled break.
    const noBreakOverlap = !breaks.some(
      (b) => isBefore(candidate, b.end) && isAfter(blockEnd, b.start)
    );
    const noAppointmentOverlap = !bookedRanges.some(
      (a) => isBefore(candidate, a.end) && isAfter(blockEnd, a.start)
    );

    if (
      fitsInWorkingHours &&
      notInPast &&
      noBreakOverlap &&
      noAppointmentOverlap
    ) {
      const local = toZonedTime(candidate, TIMEZONE);
      const hours = local.getHours().toString().padStart(2, "0");
      const mins = local.getMinutes().toString().padStart(2, "0");
      slots.push(`${hours}:${mins}`);
    }

    candidate = addMinutes(candidate, intervalMinutes);
  }

  return slots;
}

export async function getWorkingDays(barberId: string): Promise<number[]> {
  const snap = await adminDb.collection(`barbers/${barberId}/schedules`).get();
  return snap.docs
    .map((d) => d.data() as ScheduleDoc)
    .filter((s) => s.isActive)
    .map((s) => s.dayOfWeek)
    .sort((a, b) => a - b);
}

/** Matches strictly "HH:mm" with HH ∈ 01..23 and mm ∈ 00..59. The booking
 *  wizard interprets this as "barber's last working minute today" — a
 *  value of 00:00 (or worse, an unparseable string) would either flag the
 *  whole day as "already over" or crash the slot grid, so reject early. */
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getScheduleEndTimes(
  barberId: string
): Promise<Record<number, string>> {
  const snap = await adminDb.collection(`barbers/${barberId}/schedules`).get();
  const result: Record<number, string> = {};
  for (const d of snap.docs) {
    const s = d.data() as ScheduleDoc;
    if (!s.isActive) continue;
    if (!HH_MM.test(s.endTime) || s.endTime === "00:00") {
      console.warn(
        `[slots.getScheduleEndTimes] skipping invalid endTime for barber=${barberId} day=${s.dayOfWeek}: ${s.endTime}`
      );
      continue;
    }
    if (!result[s.dayOfWeek] || s.endTime > result[s.dayOfWeek]) {
      result[s.dayOfWeek] = s.endTime;
    }
  }
  return result;
}

export interface AvailabilityBundle {
  /** Bratislava-local YYYY-MM-DD of "today", aligned with the calendar matcher. */
  todayKey: string;
  /** Last bookable Bratislava-local YYYY-MM-DD (today + horizonWeeks*7). */
  horizonEndKey: string;
  workingDays: number[];
  scheduleEndTimes: Record<number, string>;
  /** Per-date override availability flag (date → isAvailable). Same shape as
   *  fetchUpcomingOverrides used by the wizard's calendar matcher. */
  overrides: Record<string, boolean>;
  /** Pre-computed slot list for every date in [todayKey, horizonEndKey]. Days
   *  outside the barber's schedule (no working day, day-off override, full day)
   *  resolve to []. The wizard reads this map directly on date-click — no
   *  follow-up fetch required. */
  slotsByDate: Record<string, string[]>;
}

interface TimeRangeUtc {
  start: Date;
  end: Date;
}

/**
 * Single-fetch availability for the booking wizard. Returns the calendar
 * disabled-state inputs (workingDays / scheduleEndTimes / overrides) AND a
 * pre-computed slot list for every date in the booking horizon.
 *
 * Replaces the older N+1 pattern (fetchWorkingDays + fetchScheduleEndTimes +
 * fetchUpcomingOverrides on barber-select, then fetchSlots per date-click).
 * Total Firestore cost is ~5 reads regardless of horizon length.
 */
export async function getAvailabilityBundle(
  barberId: string,
  serviceId: string,
  horizonWeeks: number,
  slotInterval?: number
): Promise<AvailabilityBundle> {
  const intervalMinutes = slotInterval ?? SLOT_INTERVAL_MINUTES;

  // Bratislava-local "today". Matches the wizard's calendarDisabledMatcher
  // and ensures a customer at 00:30 local time gets today rather than
  // yesterday-by-UTC.
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const horizonDays = Math.max(0, horizonWeeks * 7);
  const todayLocalDate = parseLocalDateKey(todayKey);
  const endLocalDate = addDays(todayLocalDate, horizonDays);
  const horizonEndKey = format(endLocalDate, "yyyy-MM-dd");

  // Range bounds for the appointments query — start of "today" Bratislava,
  // end of "horizonEnd" Bratislava (exclusive upper).
  const rangeStartUtc = fromZonedTime(`${todayKey}T00:00:00`, TIMEZONE);
  const rangeEndUtc = fromZonedTime(`${horizonEndKey}T00:00:00`, TIMEZONE);
  const rangeEndUtcExclusive = addDays(rangeEndUtc, 1);

  const [schedSnap, breakSnap, ovrSnap, apptsSnap, bsSnap] = await Promise.all([
    adminDb.collection(`barbers/${barberId}/schedules`).get(),
    adminDb.collection(`barbers/${barberId}/breaks`).get(),
    adminDb
      .collection(`barbers/${barberId}/overrides`)
      .where("overrideDate", ">=", todayKey)
      .where("overrideDate", "<=", horizonEndKey)
      .get(),
    adminDb
      .collection("appointments")
      .where("barberId", "==", barberId)
      .where("startTime", ">=", Timestamp.fromDate(rangeStartUtc))
      .where("startTime", "<", Timestamp.fromDate(rangeEndUtcExclusive))
      .get(),
    adminDb.doc(`barbers/${barberId}/services/${serviceId}`).get(),
  ]);

  // Schedule lookup tables
  const schedulesByDow = new Map<number, ScheduleDoc>();
  const workingDays: number[] = [];
  const scheduleEndTimes: Record<number, string> = {};
  for (const d of schedSnap.docs) {
    const s = d.data() as ScheduleDoc;
    if (!s.isActive) continue;
    schedulesByDow.set(s.dayOfWeek, s);
    workingDays.push(s.dayOfWeek);
    if (HH_MM.test(s.endTime) && s.endTime !== "00:00") {
      const prev = scheduleEndTimes[s.dayOfWeek];
      if (!prev || s.endTime > prev) scheduleEndTimes[s.dayOfWeek] = s.endTime;
    }
  }
  workingDays.sort((a, b) => a - b);

  // Breaks grouped by dayOfWeek
  const breaksByDow = new Map<number, ScheduleBreakDoc[]>();
  for (const d of breakSnap.docs) {
    const b = d.data() as ScheduleBreakDoc;
    const arr = breaksByDow.get(b.dayOfWeek);
    if (arr) arr.push(b);
    else breaksByDow.set(b.dayOfWeek, [b]);
  }

  // Overrides indexed by date string
  const overridesByDate = new Map<string, ScheduleOverrideDoc>();
  const overridesMap: Record<string, boolean> = {};
  for (const d of ovrSnap.docs) {
    const o = d.data() as ScheduleOverrideDoc;
    overridesByDate.set(o.overrideDate, o);
    overridesMap[o.overrideDate] = o.isAvailable;
  }

  // Appointments grouped by Bratislava-local date key
  const apptsByDate = new Map<string, AppointmentDoc[]>();
  for (const d of apptsSnap.docs) {
    const a = d.data() as AppointmentDoc;
    if (a.status === "CANCELLED" || a.status === "NO_SHOW") continue;
    const key = a.startDateKey;
    const arr = apptsByDate.get(key);
    if (arr) arr.push(a);
    else apptsByDate.set(key, [a]);
  }

  // Empty result if barber doesn't actually offer this service
  if (!bsSnap.exists) {
    return {
      todayKey,
      horizonEndKey,
      workingDays,
      scheduleEndTimes,
      overrides: overridesMap,
      slotsByDate: {},
    };
  }
  const bs = bsSnap.data() as BarberServiceDoc;
  const duration = bs.customDuration ?? bs.defaultDuration;
  const buffer = bs.bufferMinutes;

  const earliestStartMs = Date.now() + MIN_BOOKING_LEAD_MINUTES * 60_000;

  const slotsByDate: Record<string, string[]> = {};
  for (let i = 0; i <= horizonDays; i++) {
    const localDate = addDays(todayLocalDate, i);
    const dateKey = format(localDate, "yyyy-MM-dd");
    // localDate is constructed via `new Date(y, m-1, d)` so getDay() returns
    // the calendar day-of-week regardless of the Node process TZ.
    const dayOfWeek = localDate.getDay();

    let workStart: string | undefined;
    let workEnd: string | undefined;
    let isOverrideDay = false;

    const override = overridesByDate.get(dateKey);
    if (override) {
      if (!override.isAvailable || !override.startTime || !override.endTime) {
        slotsByDate[dateKey] = [];
        continue;
      }
      workStart = override.startTime;
      workEnd = override.endTime;
      isOverrideDay = true;
    } else {
      const sched = schedulesByDow.get(dayOfWeek);
      if (!sched) {
        slotsByDate[dateKey] = [];
        continue;
      }
      workStart = sched.startTime;
      workEnd = sched.endTime;
    }

    const breaks: TimeRangeUtc[] = isOverrideDay
      ? []
      : (breaksByDow.get(dayOfWeek) ?? []).map((b) => ({
          start: fromZonedTime(`${dateKey}T${b.startTime}:00`, TIMEZONE),
          end: fromZonedTime(`${dateKey}T${b.endTime}:00`, TIMEZONE),
        }));

    const bookedRanges: TimeRangeUtc[] = (apptsByDate.get(dateKey) ?? []).map(
      (a) => ({
        start: tsToDate(a.startTime),
        end: addMinutes(tsToDate(a.endTime), a.serviceBufferMinutes ?? 0),
      })
    );

    const workingStartUtc = fromZonedTime(
      `${dateKey}T${workStart}:00`,
      TIMEZONE
    );
    const workingEndUtc = fromZonedTime(`${dateKey}T${workEnd}:00`, TIMEZONE);

    const slots: string[] = [];
    let candidate = workingStartUtc;
    while (isBefore(candidate, workingEndUtc)) {
      const slotEnd = addMinutes(candidate, duration);
      const blockEnd = addMinutes(candidate, duration + buffer);

      const fitsInWorkingHours = !isAfter(slotEnd, workingEndUtc);
      const notInPast = candidate.getTime() >= earliestStartMs;
      const noBreakOverlap = !breaks.some(
        (b) => isBefore(candidate, b.end) && isAfter(blockEnd, b.start)
      );
      const noAppointmentOverlap = !bookedRanges.some(
        (a) => isBefore(candidate, a.end) && isAfter(blockEnd, a.start)
      );

      if (
        fitsInWorkingHours &&
        notInPast &&
        noBreakOverlap &&
        noAppointmentOverlap
      ) {
        const local = toZonedTime(candidate, TIMEZONE);
        const hours = local.getHours().toString().padStart(2, "0");
        const mins = local.getMinutes().toString().padStart(2, "0");
        slots.push(`${hours}:${mins}`);
      }

      candidate = addMinutes(candidate, intervalMinutes);
    }

    slotsByDate[dateKey] = slots;
  }

  return {
    todayKey,
    horizonEndKey,
    workingDays,
    scheduleEndTimes,
    overrides: overridesMap,
    slotsByDate,
  };
}

/** Local-clock parser — `new Date(y, m-1, d)` is timezone-stable for
 *  day-of-week math (the calendar instant, not the UTC instant, is what we
 *  want to iterate). */
function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
