import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { Button } from "@/components/ui/button";

export default function CalendarPage() {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Kalendár</h1>
        <Link href="/admin/reservations/new" className="sm:w-auto">
          <Button className="w-full sm:w-auto">
            <PlusIcon className="mr-1 size-4" />
            Nová rezervácia
          </Button>
        </Link>
      </div>
      <AdminCalendar />
    </div>
  );
}
