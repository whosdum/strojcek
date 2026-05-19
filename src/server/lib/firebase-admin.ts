import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getOrInitApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  // If full service-account creds are present (local dev via .env), use them.
  // Otherwise fall back to Application Default Credentials — Cloud Run /
  // App Hosting auto-injects the runtime identity, and FIREBASE_CONFIG
  // (auto-set by App Hosting) supplies the projectId.
  // Storage bucket: needed for getStorage().bucket() to resolve without
  // an explicit name. On App Hosting / Cloud Run, FIREBASE_CONFIG carries
  // it automatically; locally we read NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (projectId && clientEmail && rawKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: rawKey.replace(/\\n/g, "\n"),
      }),
      storageBucket,
    });
  }

  return initializeApp({ storageBucket });
}

const app = getOrInitApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
