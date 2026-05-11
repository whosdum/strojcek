import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";

const CRON_SECRET = defineSecret("CRON_SECRET");
const APP_URL = defineSecret("NEXT_PUBLIC_APP_URL");

export const sendReminders = onSchedule(
  {
    schedule: "0 14 * * *",
    timeZone: "Etc/UTC",
    region: "europe-west1",
    secrets: [CRON_SECRET, APP_URL],
    timeoutSeconds: 540,
    memory: "256MiB",
    // Lock-then-send in /api/cron/reminders is idempotent, so one retry
    // on transient network failure (cold start, DNS blip) is safe and
    // saves an entire day of reminders.
    retryCount: 1,
    minBackoffSeconds: 60,
    maxRetrySeconds: 300,
  },
  async () => {
    const url = `${APP_URL.value()}/api/cron/reminders`;
    const started = Date.now();

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${CRON_SECRET.value()}` },
        signal: AbortSignal.timeout(120_000),
      });

      const body = await res.text();
      const ms = Date.now() - started;

      if (!res.ok) {
        logger.error("sendReminders: upstream failed", {
          status: res.status,
          durationMs: ms,
          body: body.slice(0, 2000),
        });
        throw new Error(`Reminder cron failed: ${res.status}`);
      }

      logger.info("sendReminders: ok", { durationMs: ms, body });
    } catch (err) {
      const ms = Date.now() - started;
      if (err instanceof Error && err.name === "TimeoutError") {
        logger.error("sendReminders: upstream timed out after 120s", { durationMs: ms });
      }
      throw err;
    }
  },
);
