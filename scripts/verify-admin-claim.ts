/**
 * Read-only verification: does admin@strojcek.sk on the target project
 * actually have role=admin? Run with --project=strojcek-production.
 */
import { bootstrapAdminApp } from "./_firebase-bootstrap";
import { getAuth } from "firebase-admin/auth";

const { projectId } = bootstrapAdminApp();
const auth = getAuth();

async function main() {
  const email = "admin@strojcek.sk";
  const user = await auth.getUserByEmail(email);
  console.log("");
  console.log(`Project:        ${projectId}`);
  console.log(`Email:          ${user.email}`);
  console.log(`UID:            ${user.uid}`);
  console.log(`Disabled:       ${user.disabled}`);
  console.log(`Custom claims:  ${JSON.stringify(user.customClaims ?? {})}`);
  console.log(`Tokens valid after: ${user.tokensValidAfterTime}`);
  console.log("");
  if (user.customClaims?.role === "admin") {
    console.log("✅ role=admin claim is set on this user");
  } else {
    console.log("❌ role=admin claim is MISSING — re-run scripts/create-admin.ts");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
