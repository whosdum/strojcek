import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export function tsToDate(value: Timestamp | Date | undefined | null): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(0);
}

export function tsToDateOrNull(
  value: Timestamp | Date | null | undefined
): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

/** YYYY-MM-DD key in Europe/Bratislava local time. Used as denormalized startDateKey. */
export function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd", { timeZone: TIMEZONE });
}

/** Hour bucket key e.g. "2026-04-30T14" in Europe/Bratislava. */
export function hourKey(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH", { timeZone: TIMEZONE });
}

/** Strip undefined values — Firestore rejects them in writes. */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result as T;
}

/** Generate prefix tokens for customer text search. */
export function generateSearchTokens(values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const raw of values) {
    if (!raw) continue;
    const lower = raw.toLowerCase().trim();
    if (!lower) continue;

    // Word-level prefixes
    for (const word of lower.split(/\s+/)) {
      for (let i = 1; i <= word.length && i <= 20; i++) {
        tokens.add(word.slice(0, i));
      }
    }
    // Phone digits
    const digits = lower.replace(/\D/g, "");
    if (digits) {
      for (let i = 1; i <= digits.length && i <= 15; i++) {
        tokens.add(digits.slice(-i));
      }
    }
  }
  return [...tokens];
}
