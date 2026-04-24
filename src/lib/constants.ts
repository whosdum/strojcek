export const MIN_CANCEL_HOURS = 2;
export const SLOT_INTERVAL_MINUTES = 60; // Default fallback — actual value from DB (ShopSettings)
export const PAGE_SIZE = 25;
export const GLOBAL_BOOKING_LIMIT = 30;
export const PHONE_BOOKING_LIMIT_24H = 3;

export const SLOT_GROUP_BOUNDARIES = {
  morning: { label: "Dopoludnia", start: 7, end: 12 },
  afternoon: { label: "Popoludní", start: 12, end: 17 },
  evening: { label: "Večer", start: 17, end: 24 },
} as const;

export const TIMEZONE = "Europe/Bratislava";

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: ["CONFIRMED"],
  CANCELLED: ["CONFIRMED"],
  NO_SHOW: ["CONFIRMED"],
};

export const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS"];

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čakajúca",
  CONFIRMED: "Potvrdená",
  IN_PROGRESS: "Prebieha",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
  NO_SHOW: "Neprišiel",
};

export const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "default",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

export function formatCurrency(amount: number | string | { toString(): string }): string {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}
