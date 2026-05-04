export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AppointmentSource = "online" | "admin" | "walk-in";

export type SlotInterval = 15 | 30 | 60;

// View models — JS Date for frontend convenience (UI consumes these directly).

export type BarberView = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  bookingHorizonWeeks: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceView = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  bufferMinutes: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BarberServiceView = {
  serviceId: string;
  customPrice: number | null;
  customDuration: number | null;
};

export type ScheduleView = {
  id: string;
  barberId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export type ScheduleBreakView = {
  id: string;
  barberId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
};

export type ScheduleOverrideView = {
  id: string;
  barberId: string;
  overrideDate: Date;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

export type CustomerView = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  visitCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AppointmentView = {
  id: string;
  barberId: string;
  customerId: string | null;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  priceExpected: number;
  priceFinal: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  cancellationToken: string | null;
  cancellationReason: string | null;
  notes: string | null;
  source: AppointmentSource;
  reminderSentAt: Date | null;
  serviceBufferMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AppointmentStatusHistoryView = {
  id: string;
  appointmentId: string;
  oldStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  changedBy: string | null;
  reason: string | null;
  changedAt: Date;
};

export type ShopSettingsView = {
  id: string;
  slotIntervalMinutes: SlotInterval;
  updatedAt: Date;
};

// Composite view models used by UI

export type BarberWithServicesView = BarberView & {
  services: Array<BarberServiceView & { service: ServiceView }>;
};

export type BarberWithSchedulesView = BarberView & {
  schedules: ScheduleView[];
  scheduleBreaks: ScheduleBreakView[];
  overrides: ScheduleOverrideView[];
};

export type BarberFullView = BarberView & {
  services: Array<BarberServiceView & { service: ServiceView }>;
  schedules: ScheduleView[];
  scheduleBreaks: ScheduleBreakView[];
};

export type AppointmentWithBarberServiceView = AppointmentView & {
  barber: { firstName: string; lastName: string };
  service: { name: string };
};

export type AppointmentDetailView = AppointmentView & {
  barber: BarberView;
  service: ServiceView;
  customer: CustomerView | null;
  statusHistory: AppointmentStatusHistoryView[];
};

export type AppointmentTokenView = AppointmentView & {
  barber: { firstName: string; lastName: string };
  service: { name: string; durationMinutes: number; price: number };
};

export type AppointmentListView = AppointmentView & {
  barber: { firstName: string; lastName: string };
  service: { name: string };
  customer: { firstName: string; lastName: string | null; phone: string } | null;
};

export type CustomerWithAppointmentsView = CustomerView & {
  appointments: Array<
    AppointmentView & {
      barber: { firstName: string; lastName: string };
      service: { name: string };
    }
  >;
};

export type ActiveBarberWithServiceIdsView = {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  serviceIds: string[];
  serviceOverrides: Record<string, { price?: string; duration?: number }>;
  bookingHorizonWeeks: number;
};

// Notification dashboard view types — re-exports for client/UI consumers
// so they don't reach into server/types.

import type {
  NotificationKind,
  NotificationStatus,
  NotificationTrigger,
} from "@/server/types/firestore";

export type { NotificationKind, NotificationStatus, NotificationTrigger };

export interface NotificationLogView {
  id: string;
  timestamp: Date;
  kind: NotificationKind;
  status: NotificationStatus;
  appointmentId: string | null;
  recipient: string | null;
  error: string | null;
  durationMs: number | null;
  trigger: NotificationTrigger;
}

export interface NotificationStatsView {
  emailSent: number;
  emailFailed: number;
  smsSent: number;
  smsFailed: number;
  telegramSent: number;
  telegramFailed: number;
}

export interface ProblemsSnapshotView {
  /** Bookings recorded in the current Bratislava-local hour. Compared
   *  against `globalBookingsCurrentHourLimit` to show rate-limit headroom. */
  globalBookingsCurrentHour: number;
  globalBookingsCurrentHourLimit: number;
}

export interface LastCronRunView {
  /** Timestamp of the most recent notificationLog entry with trigger="cron".
   *  null when no cron has ever run (or all entries already TTL-expired). */
  lastRunAt: Date | null;
  /** Was the latest run successful (status=sent), or did it fail? */
  lastRunStatus: "sent" | "failed" | null;
  /** Milliseconds since lastRunAt (computed server-side so the render
   *  function stays pure for the React Compiler). */
  ageMs: number | null;
}

export interface TomorrowRemindersPreviewView {
  /** Tomorrow's date in Bratislava local "YYYY-MM-DD" form. */
  dateKey: string;
  emailPending: number;
  smsPending: number;
}

export interface AppointmentNotificationStatusView {
  confirmation: {
    sentAt: Date | null;
    error: string | null;
    attempts: number;
    recipient: string | null;
  };
  cancellation: {
    sentAt: Date | null;
    error: string | null;
    attempts: number;
    recipient: string | null;
  };
  reminderEmail: {
    sentAt: Date | null;
    lockedAt: Date | null;
    recipient: string | null;
  };
  reminderSms: {
    sentAt: Date | null;
    lockedAt: Date | null;
    recipient: string | null;
  };
  telegram: {
    sentAt: Date | null;
    error: string | null;
  };
}
