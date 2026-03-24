import "dotenv/config";
import { auth } from "../src/server/lib/auth";

async function main() {
  const email = "admin@strojcek.sk";
  const password = "admin123";
  const name = "Admin";

  try {
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    console.log("Admin user created successfully!");
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log("  Result:", result);
  } catch (e: any) {
    if (e?.message?.includes("already")) {
      console.log("Admin user already exists.");
      console.log(`  Email: ${email}`);
      console.log(`  Password: ${password}`);
    } else {
      console.error("Error creating admin:", e);
    }
  }
}

main();
