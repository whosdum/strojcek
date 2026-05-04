import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { addMinutes } from "date-fns";

const TIMEZONE = "Europe/Bratislava";

interface Case {
  label: string;
  dateStr: string; // YYYY-MM-DD in Bratislava
  workStart: string; // HH:mm local
  workEnd: string; // HH:mm local
  expectedFirstSlotLocal: string;
  expectedLastSlotStartLocal: string; // last 60-min slot start with 60-min duration
  /** UTC offset that should apply to the first slot (sanity check) */
  expectedFirstSlotUtcOffsetHours: number;
  expectedLastSlotUtcOffsetHours: number;
}

/**
 * DST in Europe/Bratislava 2026:
 *   - Spring forward: 2026-03-29 02:00 CET → 03:00 CEST (UTC+1 → UTC+2)
 *   - Fall back:      2026-10-25 03:00 CEST → 02:00 CET (UTC+2 → UTC+1)
 */
const cases: Case[] = [
  {
    label: "DST FORWARD (29.3.2026) — clocks jump 02:00→03:00, day has 23h",
    dateStr: "2026-03-29",
    workStart: "09:00",
    workEnd: "17:00",
    expectedFirstSlotLocal: "09:00",
    expectedLastSlotStartLocal: "16:00",
    expectedFirstSlotUtcOffsetHours: 2, // CEST
    expectedLastSlotUtcOffsetHours: 2,
  },
  {
    label: "DST BACK (25.10.2026) — clocks rewind 03:00→02:00, day has 25h",
    dateStr: "2026-10-25",
    workStart: "09:00",
    workEnd: "17:00",
    expectedFirstSlotLocal: "09:00",
    expectedLastSlotStartLocal: "16:00",
    expectedFirstSlotUtcOffsetHours: 1, // CET
    expectedLastSlotUtcOffsetHours: 1,
  },
];

function generateSlots(
  dateStr: string,
  workStart: string,
  workEnd: string,
  durationMinutes = 60,
  intervalMinutes = 60
): string[] {
  const workingStartUtc = fromZonedTime(`${dateStr}T${workStart}:00`, TIMEZONE);
  const workingEndUtc = fromZonedTime(`${dateStr}T${workEnd}:00`, TIMEZONE);

  const slots: string[] = [];
  let candidate = workingStartUtc;
  while (candidate < workingEndUtc) {
    const slotEnd = addMinutes(candidate, durationMinutes);
    if (slotEnd > workingEndUtc) break;
    const local = toZonedTime(candidate, TIMEZONE);
    const hh = local.getHours().toString().padStart(2, "0");
    const mm = local.getMinutes().toString().padStart(2, "0");
    slots.push(`${hh}:${mm}`);
    candidate = addMinutes(candidate, intervalMinutes);
  }
  return slots;
}

// Format the UTC instant in the target TZ and compare wall-clock hour to UTC
// hour to derive the offset.
function computeOffset(dateStr: string, hhmm: string): number {
  const utc = fromZonedTime(`${dateStr}T${hhmm}:00`, TIMEZONE);
  const utcHour = utc.getUTCHours();
  const wallHour = parseInt(hhmm.split(":")[0], 10);
  let diff = wallHour - utcHour;
  if (diff < -12) diff += 24;
  if (diff > 12) diff -= 24;
  return diff;
}

let failed = 0;
for (const c of cases) {
  console.log(`\n• ${c.label}`);
  const slots = generateSlots(c.dateStr, c.workStart, c.workEnd);
  console.log(`  slots=${slots.join(", ")}`);

  const firstOk = slots[0] === c.expectedFirstSlotLocal;
  const lastOk = slots[slots.length - 1] === c.expectedLastSlotStartLocal;
  const firstOffset = computeOffset(c.dateStr, c.expectedFirstSlotLocal);
  const lastOffset = computeOffset(c.dateStr, c.expectedLastSlotStartLocal);
  const firstOffsetOk = firstOffset === c.expectedFirstSlotUtcOffsetHours;
  const lastOffsetOk = lastOffset === c.expectedLastSlotUtcOffsetHours;

  console.log(
    `  first slot      = ${slots[0]} (expect ${c.expectedFirstSlotLocal}) ${firstOk ? "✓" : "✗"}`
  );
  console.log(
    `  last  slot      = ${slots[slots.length - 1]} (expect ${c.expectedLastSlotStartLocal}) ${lastOk ? "✓" : "✗"}`
  );
  console.log(
    `  first slot UTC offset = +${firstOffset}h (expect +${c.expectedFirstSlotUtcOffsetHours}h) ${firstOffsetOk ? "✓" : "✗"}`
  );
  console.log(
    `  last  slot UTC offset = +${lastOffset}h (expect +${c.expectedLastSlotUtcOffsetHours}h) ${lastOffsetOk ? "✓" : "✗"}`
  );

  if (!(firstOk && lastOk && firstOffsetOk && lastOffsetOk)) failed++;
}

if (failed > 0) {
  console.error(`\n❌ ${failed} DST case(s) failed`);
  process.exit(1);
}
console.log("\n✅ All DST cases pass");
