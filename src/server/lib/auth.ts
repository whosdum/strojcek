import { betterAuth } from "better-auth";
import { getPool } from "@/server/lib/prisma";

export const auth = betterAuth({
  database: getPool(),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
});
