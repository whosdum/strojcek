import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type {
  NotificationKind,
  NotificationStatus,
  NotificationTrigger,
} from "@/server/types/firestore";

const RETENTION_DAYS = 90;

interface RecordOptions {
  kind: NotificationKind;
  status: NotificationStatus;
  appointmentId: string | null;
  recipient: string | null;
  error?: string | null;
  durationMs?: number;
  trigger?: NotificationTrigger;
}

/**
 * Per-AppointmentDoc field group for each kind. The reminder kinds are
 * intentionally absent — they're tracked via the existing
 * `reminderEmailSentAt` / `reminderSmsSentAt` fields and the cron's
 * lock-then-send protocol; this helper only writes the audit log entry
 * for them.
 */
const APPOINTMENT_FIELD_MAP: Partial<
  Record<
    NotificationKind,
    { sentAt: string; error: string; attempts: string }
  >
> = {
  "email-confirmation": {
    sentAt: "confirmationEmailSentAt",
    error: "confirmationEmailError",
    attempts: "confirmationEmailAttempts",
  },
  "email-cancellation": {
    sentAt: "cancellationEmailSentAt",
    error: "cancellationEmailError",
    attempts: "cancellationEmailAttempts",
  },
  "telegram-alert": {
    sentAt: "telegramAlertSentAt",
    error: "telegramAlertError",
    // Telegram has no attempts counter — there's no Resend button for it.
    attempts: "",
  },
};

/**
 * Records a notification event to the audit log AND updates per-booking
 * fields on the AppointmentDoc (when applicable). Both writes are
 * best-effort and isolated — a failure of either is logged via console
 * and swallowed; the original send path's success/failure is unaffected.
 */
export async function recordNotification(opts: RecordOptions): Promise<void> {
  const trigger = opts.trigger ?? "auto";
  const now = Timestamp.now();
  const expireAt = Timestamp.fromMillis(
    now.toMillis() + RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  // Audit log write — independent of the appointment write below.
  try {
    const ref = adminDb.collection("notificationLog").doc();
    await ref.set({
      id: ref.id,
      timestamp: now,
      kind: opts.kind,
      status: opts.status,
      appointmentId: opts.appointmentId,
      recipient: opts.recipient,
      error: opts.error ?? null,
      durationMs: opts.durationMs ?? null,
      trigger,
      expireAt,
    });
  } catch (err) {
    console.error("[notification-log] audit write failed:", err);
  }

  // Per-AppointmentDoc field update — only for kinds with a field group.
  if (!opts.appointmentId) return;
  const fields = APPOINTMENT_FIELD_MAP[opts.kind];
  if (!fields) return;

  try {
    const update: Record<string, unknown> = {};
    if (opts.status === "sent") {
      update[fields.sentAt] = now;
      update[fields.error] = null;
    } else {
      update[fields.error] = opts.error ?? "unknown";
    }
    if (fields.attempts) {
      update[fields.attempts] = FieldValue.increment(1);
    }
    await adminDb.doc(`appointments/${opts.appointmentId}`).update(update);
  } catch (err) {
    console.error(
      `[notification-log] appointment field update failed for ${opts.appointmentId}:`,
      err
    );
  }
}
