import { prisma } from "@/server/lib/prisma";

export async function getShopSettings() {
  const settings = await prisma.shopSettings.findFirst();
  if (settings) return settings;

  // Create default settings if none exist
  return prisma.shopSettings.create({
    data: { slotIntervalMinutes: 60 },
  });
}
