import { config } from "dotenv";
config({ path: ".env" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing FIREBASE_* env vars");
  console.error({
    FIREBASE_PROJECT_ID: !!projectId,
    FIREBASE_CLIENT_EMAIL: !!clientEmail,
    FIREBASE_PRIVATE_KEY: !!privateKey,
  });
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

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
