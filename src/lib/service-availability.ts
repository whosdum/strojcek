export type ServiceTimeWindow = { startTime: string; endTime: string };

/**
 * Online-booking window of a service per day of week (keys "0".."6",
 * 0 = Sunday — same as ScheduleDoc.dayOfWeek). A missing key means the
 * service follows the barber's whole working day; `null` means it can't be
 * booked online that day. The service must END by `endTime`.
 */
export type ServiceAvailability = Partial<
  Record<string, ServiceTimeWindow | null>
>;

/** Monday-first display order with Slovak short names. */
export const SERVICE_DAYS = [
  { key: "1", short: "Po", long: "Pondelok" },
  { key: "2", short: "Ut", long: "Utorok" },
  { key: "3", short: "St", long: "Streda" },
  { key: "4", short: "Št", long: "Štvrtok" },
  { key: "5", short: "Pi", long: "Piatok" },
  { key: "6", short: "So", long: "Sobota" },
  { key: "0", short: "Ne", long: "Nedeľa" },
] as const;

/**
 * Narrows the working hours of a day to the service window. Returns null
 * when the service isn't bookable that day. "HH:mm" strings compare
 * correctly as plain strings.
 */
export function clipToServiceWindow(
  workStart: string,
  workEnd: string,
  availability: ServiceAvailability | null | undefined,
  dayOfWeek: number
): { start: string; end: string } | null {
  const key = String(dayOfWeek);
  if (!availability || !(key in availability)) {
    return { start: workStart, end: workEnd };
  }
  const w = availability[key];
  if (!w) return null;
  const start = w.startTime > workStart ? w.startTime : workStart;
  const end = w.endTime < workEnd ? w.endTime : workEnd;
  return start < end ? { start, end } : null;
}

/** "07:00" → "7:00" */
function shortTime(t: string): string {
  return t.replace(/^0(\d)/, "$1");
}

/**
 * Customer-facing hint, e.g. "Po–Pi 7:00–12:00 · So nedostupné". Only
 * restricted days are listed; consecutive days with the same window are
 * merged. Returns null when the service has no restriction.
 */
export function formatServiceAvailability(
  availability: ServiceAvailability | null | undefined
): string | null {
  if (!availability) return null;

  const groups: { from: string; to: string; label: string }[] = [];
  let prevLabel: string | null = null;
  for (const day of SERVICE_DAYS) {
    if (!(day.key in availability)) {
      prevLabel = null;
      continue;
    }
    const w = availability[day.key];
    const label = w
      ? `${shortTime(w.startTime)}–${shortTime(w.endTime)}`
      : "nedostupné";
    const last = groups[groups.length - 1];
    if (last && prevLabel === label) {
      last.to = day.short;
    } else {
      groups.push({ from: day.short, to: day.short, label });
    }
    prevLabel = label;
  }
  if (groups.length === 0) return null;

  return groups
    .map((g) => `${g.from === g.to ? g.from : `${g.from}–${g.to}`} ${g.label}`)
    .join(" · ");
}
