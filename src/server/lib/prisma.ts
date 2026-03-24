import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function getConnectionString() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Please add it to your .env file."
    );
  }
  return process.env.DATABASE_URL;
}

/** Shared pg.Pool — reused by Better Auth to avoid duplicate connections */
export function getPool() {
  if (!globalForDb.pool) {
    globalForDb.pool = new Pool({ connectionString: getConnectionString() });
  }
  return globalForDb.pool;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: getConnectionString() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForDb.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForDb.prisma = prisma;
