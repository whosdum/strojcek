import "dotenv/config";
import { recordNotification } from "../src/server/lib/notification-log";
import { adminDb } from "../src/server/lib/firebase-admin";

async function main() {
  console.log("• Writing a test notification log entry…");
  await recordNotification({
    kind: "email-confirmation",
    status: "sent",
    appointmentId: null,
    recipient: "verify@example.com",
    durationMs: 42,
    trigger: "manual",
  });

  const snap = await adminDb
    .collection("notificationLog")
    .where("recipient", "==", "verify@example.com")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (snap.empty) {
    console.error("✗ No log entry found.");
    process.exit(1);
  }

  const data = snap.docs[0].data();
  // 90-day retention is the contract; allow 1 minute drift for clock skew.
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const checks: Array<[string, boolean]> = [
    ["timestamp present", !!data.timestamp],
    ["expireAt present", !!data.expireAt],
    [
      "expireAt ≈ timestamp + 90d",
      Math.abs(
        data.expireAt.toMillis() - data.timestamp.toMillis() - NINETY_DAYS_MS
      ) < 60_000,
    ],
    ["kind === email-confirmation", data.kind === "email-confirmation"],
    ["status === sent", data.status === "sent"],
    ["trigger === manual", data.trigger === "manual"],
  ];

  let pass = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) pass = false;
  }

  await snap.docs[0].ref.delete();
  console.log("• Cleaned up test doc.");

  if (!pass) {
    console.error("\n❌ Some checks failed.");
    process.exit(1);
  }
  console.log("\n✅ TTL field is set correctly.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
