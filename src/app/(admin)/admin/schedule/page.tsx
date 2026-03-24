import { getAllBarbersWithSchedules } from "@/server/queries/barbers";
import { getShopSettings } from "@/server/queries/settings";
import { ScheduleManager } from "@/components/admin/schedule-manager";
import { SlotIntervalSetting } from "@/components/admin/slot-interval-setting";

export default async function SchedulePage() {
  const [barbers, settings] = await Promise.all([
    getAllBarbersWithSchedules(),
    getShopSettings(),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Rozvrh</h1>
      <div className="mb-8">
        <SlotIntervalSetting currentInterval={settings.slotIntervalMinutes} />
      </div>
      <ScheduleManager barbers={barbers} />
    </div>
  );
}
