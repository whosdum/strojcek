import type { Timestamp } from "firebase-admin/firestore";

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AppointmentSource = "online" | "admin";

export type SlotInterval = 15 | 30 | 60;

export type BarberDoc = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  serviceIds: string[];
  bookingHorizonWeeks: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type BarberServiceDoc = {
  serviceId: string;
  customPriceCents: number | null;
  customDuration: number | null;
  serviceName: string;
  defaultDuration: number;
  bufferMinutes: number;
  defaultPriceCents: number;
};

export type ServiceDoc = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  bufferMinutes: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CustomerDoc = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  phoneSearch: string;
  email: string | null;
  emailSearch: string | null;
  notes: string | null;
  visitCount: number;
  searchTokens: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CustomerPhoneIndexDoc = {
  customerId: string;
};

export type AppointmentDoc = {
  id: string;
  barberId: string;
  customerId: string | null;
  serviceId: string;

  barberName: string;
  serviceName: string;
  serviceBufferMinutes: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;

  startTime: Timestamp;
  endTime: Timestamp;
  startDateKey: string;

  status: AppointmentStatus;

  priceExpectedCents: number;
  priceFinalCents: number | null;

  cancellationTokenHash: string | null;
  cancellationTokenFallback: string | null;
  cancellationReason: string | null;

  notes: string | null;
  source: AppointmentSource;
  /** @deprecated Use reminderEmailSentAt / reminderSmsSentAt. Kept for
   *  legacy data; if set, the appointment is treated as fully reminded. */
  reminderSentAt?: Timestamp | null;
  /** Per-channel reminder state — set after a successful send. */
  reminderEmailSentAt?: Timestamp | null;
  reminderSmsSentAt?: Timestamp | null;
  /** Two-phase lock for the cron worker. Cleared on success or release. */
  reminderEmailLockedAt?: Timestamp | null;
  reminderSmsLockedAt?: Timestamp | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AppointmentStatusHistoryDoc = {
  id: string;
  oldStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  changedBy: string | null;
  reason: string | null;
  changedAt: Timestamp;
};

export type ScheduleDoc = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export type ScheduleBreakDoc = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
};

export type ScheduleOverrideDoc = {
  overrideDate: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

export type ShopSettingsDoc = {
  slotIntervalMinutes: SlotInterval;
  updatedAt: Timestamp;
};

export type AdminUserDoc = {
  email: string;
  name: string;
  role: "admin";
  createdAt: Timestamp;
};

export type PhoneBookingsCounterDoc = {
  bookings: Timestamp[];
};

export type GlobalBookingsCounterDoc = {
  hourly: { [hourKey: string]: number };
};
