"use server";

import { prisma } from "@/server/lib/prisma";
import { getShopSettings } from "@/server/queries/settings";

const VALID_INTERVALS = [15, 30, 60];

export async function updateSlotInterval(
  minutes: number
): Promise<{ success: boolean; error?: string }> {
  if (!VALID_INTERVALS.includes(minutes)) {
    return {
      success: false,
      error: `Neplatný interval. Povolené hodnoty: ${VALID_INTERVALS.join(", ")} minút.`,
    };
  }

  const settings = await getShopSettings();
  await prisma.shopSettings.update({
    where: { id: settings.id },
    data: { slotIntervalMinutes: minutes },
  });

  return { success: true };
}
