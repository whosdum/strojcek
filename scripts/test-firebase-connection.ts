import { bootstrapAdminApp } from "./_firebase-bootstrap";
import { getFirestore } from "firebase-admin/firestore";

const { projectId } = bootstrapAdminApp();
const db = getFirestore();

async function main() {
  console.log(`Connecting as project: ${projectId}`);
  const ref = db.collection("_connectionTest").doc("ping");
  await ref.set({ at: new Date().toISOString() });
  const snap = await ref.get();
  console.log("✓ write+read ok:", snap.data());
  await ref.delete();
  console.log("✓ delete ok — connection works");
}

main().catch((err) => {
  console.error("✗ FAIL:", err.message);
  process.exit(1);
});
