import { getAllBarbersWithSchedules } from "@/server/queries/barbers";
import { ScheduleManager } from "@/components/admin/schedule-manager";

export default async function SchedulePage() {
  const barbers = await getAllBarbersWithSchedules();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Rozvrh</h1>
      <ScheduleManager barbers={barbers} />
    </div>
  );
}
