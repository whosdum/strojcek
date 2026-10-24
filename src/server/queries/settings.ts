import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { tsToDate } from "@/server/lib/firestore-utils";
import type { ShopSettingsView, SlotInterval } from "@/lib/types";
import type { ShopSettingsDoc } from "@/server/types/firestore";
import { MIN_BOOKING_LEAD_MINUTES } from "@/lib/business-info";

const SETTINGS_DOC = "shopSettings/default";

export async function getShopSettings(): Promise<ShopSettingsView> {
  const ref = adminDb.doc(SETTINGS_DOC);
  const snap = await ref.get();

  if (snap.exists) {
    const d = snap.data() as ShopSettingsDoc;
    return {
      id: snap.id,
      slotIntervalMinutes: d.slotIntervalMinutes,
      minBookingLeadMinutes: d.minBookingLeadMinutes ?? MIN_BOOKING_LEAD_MINUTES,
      updatedAt: tsToDate(d.updatedAt),
    };
  }

  const initial: ShopSettingsDoc = {
    slotIntervalMinutes: 60 as SlotInterval,
    updatedAt: Timestamp.now(),
  };
  await ref.set(initial);
  return {
    id: "default",
    slotIntervalMinutes: initial.slotIntervalMinutes,
    minBookingLeadMinutes: MIN_BOOKING_LEAD_MINUTES,
    updatedAt: tsToDate(initial.updatedAt),
  };
}
