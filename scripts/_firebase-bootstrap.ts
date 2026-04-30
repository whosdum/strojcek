/**
 * Shared bootstrap for one-shot admin scripts (create-admin.ts, seed-firestore.ts).
 *
 * Selects a Firebase project + service-account key based on `--project=NAME`
 * or the FIREBASE_TARGET env var; defaults to `strojcek-staging`.
 *
 * Service account key resolution order:
 *   1. `serviceAccountKey-${project}.json` at repo root
 *   2. `serviceAccountKey.json` (legacy fallback)
 *   3. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env vars (only if the
 *      target project matches FIREBASE_PROJECT_ID — prevents the staging
 *      key from accidentally writing to production).
 */
import "dotenv/config";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export interface BootstrapResult {
  projectId: string;
}

export function bootstrapAdminApp(): BootstrapResult {
  if (getApps().length) {
    throw new Error("firebase-admin already initialized");
  }

  const fromArg = process.argv
    .slice(2)
    .find((a) => a.startsWith("--project="))
    ?.slice("--project=".length);
  const projectId =
    fromArg ?? process.env.FIREBASE_TARGET ?? "strojcek-staging";

  const candidates = [
    resolve(process.cwd(), `serviceAccountKey-${projectId}.json`),
    resolve(process.cwd(), "serviceAccountKey.json"),
  ];
  const keyPath = candidates.find((p) => existsSync(p));

  if (keyPath) {
    const raw = JSON.parse(readFileSync(keyPath, "utf-8"));
    if (raw.project_id !== projectId) {
      throw new Error(
        `Refusing to use ${keyPath} (project_id=${raw.project_id}) for target ${projectId}. ` +
          `Save the matching key as serviceAccountKey-${projectId}.json.`
      );
    }
    initializeApp({
      credential: cert({
        projectId: raw.project_id,
        clientEmail: raw.client_email,
        privateKey: raw.private_key,
      }),
    });
    console.log(`Using service-account key: ${keyPath} (project ${projectId})`);
    return { projectId };
  }

  // Fallback: dotenv vars — but only if they match the target.
  const envPid = process.env.FIREBASE_PROJECT_ID;
  const envEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const envKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (envPid && envEmail && envKey) {
    if (envPid !== projectId) {
      throw new Error(
        `dotenv FIREBASE_PROJECT_ID=${envPid} does not match target ${projectId}. ` +
          `Save the matching key as serviceAccountKey-${projectId}.json or change FIREBASE_TARGET.`
      );
    }
    initializeApp({
      credential: cert({
        projectId: envPid,
        clientEmail: envEmail,
        privateKey: envKey,
      }),
    });
    console.log(`Using FIREBASE_* env vars (project ${projectId})`);
    return { projectId };
  }

  throw new Error(
    `No credentials found for ${projectId}. Either:\n` +
      `  • download a service account key as serviceAccountKey-${projectId}.json\n` +
      `  • or set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in dotenv`
  );
}
