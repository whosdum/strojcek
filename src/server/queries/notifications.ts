import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { tsToDate, tsToDateOrNull, hourKey } from "@/server/lib/firestore-utils";
import { GLOBAL_BOOKING_LIMIT } from "@/lib/constants";
import type {
  NotificationLogDoc,
  NotificationKind,
  NotificationStatus,
  AppointmentDoc,
} from "@/server/types/firestore";
import type {
  NotificationLogView,
  NotificationStatsView,
  ProblemsSnapshotView,
  AppointmentNotificationStatusView,
} from "@/lib/types";

function mapLog(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): NotificationLogView {
  const d = doc.data() as NotificationLogDoc;
  return {
    id: doc.id,
    timestamp: tsToDate(d.timestamp),
    kind: d.kind,
    status: d.status,
    appointmentId: d.appointmentId,
    recipient: d.recipient,
    error: d.error,
    durationMs: d.durationMs,
    trigger: d.trigger,
  };
}

interface GetLogOpts {
  limit?: number;
  kind?: NotificationKind;
  status?: NotificationStatus;
  appointmentId?: string;
  sinceMs?: number;
}

export async function getNotificationLog(
  opts: GetLogOpts = {}
): Promise<NotificationLogView[]> {
  let q: FirebaseFirestore.Query = adminDb.collection("notificationLog");
  if (opts.kind) q = q.where("kind", "==", opts.kind);
  if (opts.status) q = q.where("status", "==", opts.status);
  if (opts.appointmentId) q = q.where("appointmentId", "==", opts.appointmentId);
  if (opts.sinceMs) {
    q = q.where("timestamp", ">=", Timestamp.fromMillis(opts.sinceMs));
  }
  q = q.orderBy("timestamp", "desc").limit(opts.limit ?? 100);
  const snap = await q.get();
  return snap.docs.map(mapLog);
}

export async function getNotificationStats(opts: {
  sinceMs: number;
}): Promise<NotificationStatsView> {
  const snap = await adminDb
    .collection("notificationLog")
    .where("timestamp", ">=", Timestamp.fromMillis(opts.sinceMs))
    .get();

  const stats: NotificationStatsView = {
    emailSent: 0,
    emailFailed: 0,
    smsSent: 0,
    smsFailed: 0,
    telegramSent: 0,
    telegramFailed: 0,
  };
  for (const doc of snap.docs) {
    const d = doc.data() as NotificationLogDoc;
    if (d.kind.startsWith("email-")) {
      if (d.status === "sent") stats.emailSent++;
      else stats.emailFailed++;
    } else if (d.kind === "sms-reminder") {
      if (d.status === "sent") stats.smsSent++;
      else stats.smsFailed++;
    } else if (d.kind === "telegram-alert") {
      if (d.status === "sent") stats.telegramSent++;
      else stats.telegramFailed++;
    }
  }
  return stats;
}

export async function getProblemsSnapshot(): Promise<ProblemsSnapshotView> {
  const globalSnap = await adminDb.doc("counters/global_bookings").get();
  const hourly = globalSnap.exists
    ? ((globalSnap.data() as { hourly?: Record<string, number> }).hourly ?? {})
    : {};
  const currentHourKey = hourKey(new Date());
  const currentCount = hourly[currentHourKey] ?? 0;

  return {
    globalBookingsCurrentHour: currentCount,
    globalBookingsCurrentHourLimit: GLOBAL_BOOKING_LIMIT,
  };
}

export async function getAppointmentNotificationStatus(
  appointmentId: string
): Promise<AppointmentNotificationStatusView | null> {
  const snap = await adminDb.doc(`appointments/${appointmentId}`).get();
  if (!snap.exists) return null;
  const d = snap.data() as AppointmentDoc;
  return {
    confirmation: {
      sentAt: tsToDateOrNull(d.confirmationEmailSentAt),
      error: d.confirmationEmailError ?? null,
      attempts: d.confirmationEmailAttempts ?? 0,
      recipient: d.customerEmail ?? null,
    },
    cancellation: {
      sentAt: tsToDateOrNull(d.cancellationEmailSentAt),
      error: d.cancellationEmailError ?? null,
      attempts: d.cancellationEmailAttempts ?? 0,
      recipient: d.customerEmail ?? null,
    },
    reminderEmail: {
      sentAt: tsToDateOrNull(d.reminderEmailSentAt),
      lockedAt: tsToDateOrNull(d.reminderEmailLockedAt),
      recipient: d.customerEmail ?? null,
    },
    reminderSms: {
      sentAt: tsToDateOrNull(d.reminderSmsSentAt),
      lockedAt: tsToDateOrNull(d.reminderSmsLockedAt),
      recipient: d.customerPhone ?? null,
    },
    telegram: {
      sentAt: tsToDateOrNull(d.telegramAlertSentAt),
      error: d.telegramAlertError ?? null,
    },
  };
}
