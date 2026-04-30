import "dotenv/config";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_* env vars in .env");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  const email = "admin@strojcek.sk";
  const password = "admin123";
  const name = "Admin";

  let uid: string;

  try {
    const user = await auth.createUser({ email, password, displayName: name });
    uid = user.uid;
    console.log("Admin user created.");
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      console.log("Admin user already exists, ensuring role + Firestore doc.");
    } else {
      console.error("Failed to create admin user:", err);
      process.exit(1);
    }
  }

  await auth.setCustomUserClaims(uid, { role: "admin" });

  await db.collection("users").doc(uid).set(
    {
      email,
      name,
      role: "admin",
      createdAt: Timestamp.now(),
    },
    { merge: true }
  );

  console.log("");
  console.log("Admin ready:");
  console.log(`  uid:      ${uid}`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log("");
  console.log(
    "Note: custom claim 'role=admin' propagates on next ID-token refresh."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
