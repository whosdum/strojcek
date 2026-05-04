import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { tsToDate, tsToDateOrNull, hourKey } from "@/server/lib/firestore-utils";
import { GLOBAL_BOOKING_LIMIT, TIMEZONE } from "@/lib/constants";
import { dateKey as toDateKey } from "@/server/lib/firestore-utils";
import { addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
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
  LastCronRunView,
  TomorrowRemindersPreviewView,
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
  recipient?: string;
  sinceMs?: number;
}

/**
 * Filter strategy: Firestore composite indexes only cover specific
 * (where..., orderBy timestamp) combinations. Rather than ship every
 * permutation of indexes, we pick ONE field for the server-side
 * `where` (most-specific first: appointmentId > recipient > status >
 * kind) and apply the rest in JS post-filter on the result. The 100-row
 * cap keeps post-filter cost negligible.
 */
export async function getNotificationLog(
  opts: GetLogOpts = {}
): Promise<NotificationLogView[]> {
  let q: FirebaseFirestore.Query = adminDb.collection("notificationLog");
  let serverFilter: keyof GetLogOpts | null = null;
  if (opts.appointmentId) {
    q = q.where("appointmentId", "==", opts.appointmentId);
    serverFilter = "appointmentId";
  } else if (opts.recipient) {
    q = q.where("recipient", "==", opts.recipient);
    serverFilter = "recipient";
  } else if (opts.status) {
    q = q.where("status", "==", opts.status);
    serverFilter = "status";
  } else if (opts.kind) {
    q = q.where("kind", "==", opts.kind);
    serverFilter = "kind";
  }
  if (opts.sinceMs) {
    q = q.where("timestamp", ">=", Timestamp.fromMillis(opts.sinceMs));
  }
  q = q.orderBy("timestamp", "desc").limit(opts.limit ?? 100);
  const snap = await q.get();

  let results = snap.docs.map(mapLog);
  // Apply remaining filters in JS — whichever ones we didn't push to
  // the server query.
  if (serverFilter !== "kind" && opts.kind) {
    results = results.filter((r) => r.kind === opts.kind);
  }
  if (serverFilter !== "status" && opts.status) {
    results = results.filter((r) => r.status === opts.status);
  }
  if (serverFilter !== "recipient" && opts.recipient) {
    results = results.filter((r) => r.recipient === opts.recipient);
  }
  return results;
}

export async function getLastCronRun(): Promise<LastCronRunView> {
  const snap = await adminDb
    .collection("notificationLog")
    .where("trigger", "==", "cron")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();
  if (snap.empty)
    return { lastRunAt: null, lastRunStatus: null, ageMs: null };
  const d = snap.docs[0].data() as NotificationLogDoc;
  const lastRunAt = tsToDate(d.timestamp);
  return {
    lastRunAt,
    lastRunStatus: d.status,
    ageMs: Date.now() - lastRunAt.getTime(),
  };
}

export async function getTomorrowRemindersPreview(): Promise<TomorrowRemindersPreviewView> {
  const nowLocal = toZonedTime(new Date(), TIMEZONE);
  const tomorrowKey = toDateKey(addDays(nowLocal, 1));

  const snap = await adminDb
    .collection("appointments")
    .where("startDateKey", "==", tomorrowKey)
    .where("status", "==", "CONFIRMED")
    .get();

  let emailPending = 0;
  let smsPending = 0;
  for (const doc of snap.docs) {
    const a = doc.data() as AppointmentDoc;
    // The cron's "is this already done?" check considers BOTH the legacy
    // single `reminderSentAt` field and the per-channel ones, so mirror
    // that here.
    if (a.reminderSentAt != null) continue;
    if (a.customerEmail && a.reminderEmailSentAt == null) emailPending++;
    if (a.customerPhone && a.reminderSmsSentAt == null) smsPending++;
  }

  return { dateKey: tomorrowKey, emailPending, smsPending };
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
