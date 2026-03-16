import { prisma } from "@/server/lib/prisma";

export async function getActiveServices() {
  return prisma.service.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAllServices() {
  return prisma.service.findMany({
    orderBy: { sortOrder: "asc" },
  });
}
