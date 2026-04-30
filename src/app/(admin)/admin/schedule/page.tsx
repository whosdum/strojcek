import { getAllBarbersWithSchedules } from "@/server/queries/barbers";
import { getShopSettings } from "@/server/queries/settings";
import { ScheduleManager } from "@/components/admin/schedule-manager";
import { SlotIntervalSetting } from "@/components/admin/slot-interval-setting";
import Link from "next/link";

export default async function SchedulePage() {
  const [barbers, settings] = await Promise.all([
    getAllBarbersWithSchedules(),
    getShopSettings(),
  ]);

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Rozvrh</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">Rozvrh</h1>
      <div className="mb-8">
        <SlotIntervalSetting currentInterval={settings.slotIntervalMinutes} />
      </div>
      <ScheduleManager barbers={barbers} />
    </div>
  );
}
