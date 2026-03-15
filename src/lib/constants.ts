export const MIN_CANCEL_HOURS = 2;
export const SLOT_INTERVAL_MINUTES = 15;
export const DEFAULT_BUFFER_MINUTES = 5;
export const PAGE_SIZE = 25;

export const SLOT_GROUP_BOUNDARIES = {
  morning: { label: "Ráno", start: 0, end: 12 },
  afternoon: { label: "Poobede", start: 12, end: 16 },
  evening: { label: "Večer", start: 16, end: 24 },
} as const;

export const TIMEZONE = "Europe/Bratislava";

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS"];
