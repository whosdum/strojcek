/**
 * Updates the password for admin@strojcek.sk in Firebase Auth.
 *
 * Usage:
 *   npx tsx scripts/set-admin-password.ts --project=strojcek-staging --password='NEW_PASSWORD'
 *   npx tsx scripts/set-admin-password.ts --project=strojcek-production --password='NEW_PASSWORD'
 *   npx tsx scripts/set-admin-password.ts --project=strojcek-production --generate    # prints a random 24-char password
 *
 * The new password must be at least 12 characters. Shorter values are
 * rejected so we don't accidentally regress to admin123-class strength.
 */

import { bootstrapAdminApp } from "./_firebase-bootstrap";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "crypto";

const { projectId } = bootstrapAdminApp();
const auth = getAuth();

function getFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((a) => a.startsWith(prefix))
    ?.slice(prefix.length);
}
function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function generatePassword(): string {
  // 24 chars from URL-safe base64. ~144 bits entropy.
  return randomBytes(18).toString("base64url");
}

async function main() {
  const email = "admin@strojcek.sk";

  let password = getFlag("password");
  if (!password && hasFlag("generate")) {
    password = generatePassword();
    console.log(`\nGenerated password: ${password}`);
    console.log(`(Copy it now — won't be shown again.)\n`);
  }
  if (!password) {
    console.error(
      "Provide --password='...' or --generate. Password must be ≥12 chars."
    );
    process.exit(1);
  }
  if (password.length < 12) {
    console.error(
      `Password too short (${password.length} chars). Minimum 12 required.`
    );
    process.exit(1);
  }

  const user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password });

  // Bump the refresh-token revocation marker so any existing __session
  // cookies become invalid on next verifySessionCookie() call.
  await auth.revokeRefreshTokens(user.uid);

  console.log(`Updated password for ${email} (uid=${user.uid}) in project ${projectId}.`);
  console.log(`Existing sessions revoked — admin must re-login.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
