import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { dateKey } from "@/server/lib/firestore-utils";
import { verifyCronAuth } from "@/server/lib/cron-auth";
import { sendEmail } from "@/server/lib/email";
import { sendSMS } from "@/server/lib/sms";
import { stripDiacritics } from "@/server/lib/strings";
import { bookingReminderHtml } from "@/emails/booking-reminder";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { SHOP_PHONE_DISPLAY } from "@/lib/business-info";
import type { AppointmentDoc } from "@/server/types/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Up to N reminders fanned out at once. SMTP + SMSTools both happily
 *  handle a small parallel burst; sequential sends timed out the
 *  GitHub Actions step on busy days. */
const CHUNK_SIZE = 5;

/** A locked-but-never-completed reminder is considered abandoned after
 *  this window. Caller crashed mid-send → next cron retries. */
const LOCK_TTL_MS = 5 * 60_000;

type Channel = "email" | "sms";

interface ChannelFields {
  sentAt: "reminderEmailSentAt" | "reminderSmsSentAt";
  lockedAt: "reminderEmailLockedAt" | "reminderSmsLockedAt";
}

const CHANNEL_FIELDS: Record<Channel, ChannelFields> = {
  email: {
    sentAt: "reminderEmailSentAt",
    lockedAt: "reminderEmailLockedAt",
  },
  sms: {
    sentAt: "reminderSmsSentAt",
    lockedAt: "reminderSmsLockedAt",
  },
};

/** Read with legacy compat: an appointment whose deprecated single
 *  `reminderSentAt` is set is considered done on every channel. New
 *  writes only touch the per-channel fields. */
function alreadySent(appt: AppointmentDoc, channel: Channel): boolean {
  if (appt.reminderSentAt != null) return true;
  return appt[CHANNEL_FIELDS[channel].sentAt] != null;
}

function isLockStale(
  appt: AppointmentDoc,
  channel: Channel,
  nowMs: number
): boolean {
  const value = appt[CHANNEL_FIELDS[channel].lockedAt];
  if (value == null) return true; // not locked
  return nowMs - value.toMillis() > LOCK_TTL_MS;
}

/** Try to claim a channel by setting the per-channel lock inside a tx.
 *  Returns true if we won the claim and should proceed to send. */
async function tryClaim(
  ref: FirebaseFirestore.DocumentReference,
  channel: Channel
): Promise<boolean> {
  const f = CHANNEL_FIELDS[channel];
  return adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return false;
    const data = fresh.data() as AppointmentDoc;
    if (data.status !== "CONFIRMED") return false;
    if (alreadySent(data, channel)) return false;
    if (!isLockStale(data, channel, Date.now())) return false;

    tx.update(ref, { [f.lockedAt]: Timestamp.now() });
    return true;
  });
}

async function markSent(
  ref: FirebaseFirestore.DocumentReference,
  channel: Channel
) {
  const f = CHANNEL_FIELDS[channel];
  await ref.update({
    [f.sentAt]: Timestamp.now(),
    [f.lockedAt]: null,
  });
}

async function releaseLock(
  ref: FirebaseFirestore.DocumentReference,
  channel: Channel
) {
  const f = CHANNEL_FIELDS[channel];
  await ref.update({ [f.lockedAt]: null });
}

interface Counters {
  emailSent: number;
  smsSent: number;
  emailFailed: number;
  smsFailed: number;
}

async function processEmail(
  ref: FirebaseFirestore.DocumentReference,
  appt: AppointmentDoc,
  counters: Counters
) {
  if (!appt.customerEmail) return;
  if (alreadySent(appt, "email")) return;
  const claimed = await tryClaim(ref, "email").catch((err) => {
    console.error(`[cron/reminders] email claim failed for ${ref.id}:`, err);
    return false;
  });
  if (!claimed) return;

  try {
    const localStart = toZonedTime(appt.startTime.toDate(), TIMEZONE);
    const result = await sendEmail({
      to: appt.customerEmail,
      subject: "Pripomienka rezervácie — Strojček",
      html: bookingReminderHtml({
        customerName: appt.customerName || "zákazník",
        serviceName: appt.serviceName,
        barberName: appt.barberName,
        date: format(localStart, "d.M.yyyy"),
        time: format(localStart, "HH:mm"),
      }),
    });
    if (!result.success) throw result.error ?? new Error("send failed");
    await markSent(ref, "email");
    counters.emailSent++;
  } catch (err) {
    console.error(`[cron/reminders] email send failed for ${ref.id}:`, err);
    await releaseLock(ref, "email").catch(() => {});
    counters.emailFailed++;
  }
}

async function processSms(
  ref: FirebaseFirestore.DocumentReference,
  appt: AppointmentDoc,
  counters: Counters
) {
  if (!appt.customerPhone) return;
  if (alreadySent(appt, "sms")) return;
  const claimed = await tryClaim(ref, "sms").catch((err) => {
    console.error(`[cron/reminders] sms claim failed for ${ref.id}:`, err);
    return false;
  });
  if (!claimed) return;

  try {
    const localStart = toZonedTime(appt.startTime.toDate(), TIMEZONE);
    await sendSMS({
      phone: appt.customerPhone,
      message: `Strojcek: zajtra o ${format(localStart, "HH:mm")} mate rezervaciu na ${stripDiacritics(appt.serviceName)}. Pre zrusenie zavolajte ${SHOP_PHONE_DISPLAY}.`,
    });
    await markSent(ref, "sms");
    counters.smsSent++;
  } catch (err) {
    console.error(`[cron/reminders] sms send failed for ${ref.id}:`, err);
    await releaseLock(ref, "sms").catch(() => {});
    counters.smsFailed++;
  }
}

async function processOne(
  d: FirebaseFirestore.QueryDocumentSnapshot,
  counters: Counters
) {
  const appt = d.data() as AppointmentDoc;
  // Both channels run in parallel for one appointment — they share no
  // state and a slow SMTP shouldn't delay the SMS.
  await Promise.all([
    processEmail(d.ref, appt, counters),
    processSms(d.ref, appt, counters),
  ]);
}

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  const nowLocal = toZonedTime(new Date(), TIMEZONE);
  const tomorrowKey = dateKey(addDays(nowLocal, 1));

  const snap = await adminDb
    .collection("appointments")
    .where("startDateKey", "==", tomorrowKey)
    .where("status", "==", "CONFIRMED")
    .get();

  // Skip appointments where BOTH channels are already done. The
  // per-channel checks inside processOne also early-exit, so this is
  // just an optimization to avoid spinning up no-op workers.
  const candidates = snap.docs.filter((d) => {
    const data = d.data() as AppointmentDoc;
    if (data.reminderSentAt != null) return false;
    const emailDone = !data.customerEmail || alreadySent(data, "email");
    const smsDone = !data.customerPhone || alreadySent(data, "sms");
    return !(emailDone && smsDone);
  });

  const counters: Counters = {
    emailSent: 0,
    smsSent: 0,
    emailFailed: 0,
    smsFailed: 0,
  };

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map((d) => processOne(d, counters)));
  }

  return NextResponse.json({
    ok: true,
    found: candidates.length,
    emailSent: counters.emailSent,
    smsSent: counters.smsSent,
    emailFailed: counters.emailFailed,
    smsFailed: counters.smsFailed,
  });
}
