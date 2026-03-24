import { getTodayAppointments, getUpcomingAppointments, getDayStats } from "@/server/queries/appointments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { CalendarDaysIcon, ClockIcon, UsersIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čaká",
  CONFIRMED: "Potvrdená",
  IN_PROGRESS: "Prebieha",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
  NO_SHOW: "Neprišiel",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "default",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

export default async function AdminDashboardPage() {
  const [todayAppointments, upcoming, stats] = await Promise.all([
    getTodayAppointments(),
    getUpcomingAppointments(5),
    getDayStats(new Date()),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Dashboard</h1>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-start gap-3 pt-4">
            <CalendarDaysIcon className="size-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Dnes rezervácií</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-4">
            <ClockIcon className="size-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{todayAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Aktívnych</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-4">
            <UsersIcon className="size-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Dokončených</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-4">
            <TrendingUpIcon className="size-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.noShow}</p>
              <p className="text-xs text-muted-foreground">Neprišiel</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's appointments */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dnešné rezervácie</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žiadne rezervácie na dnes.</p>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/admin/reservations/${appt.id}`}
                    className="flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{appt.customerName}</p>
                      <p className="text-muted-foreground">
                        {format(appt.startTime, "HH:mm")} — {appt.service.name}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANTS[appt.status]}
                      className="self-start"
                    >
                      {STATUS_LABELS[appt.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nadchádzajúce</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žiadne nadchádzajúce rezervácie.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/admin/reservations/${appt.id}`}
                    className="flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{appt.customerName}</p>
                      <p className="text-muted-foreground">
                        {format(appt.startTime, "EEE d.M. HH:mm", { locale: sk })} — {appt.service.name}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANTS[appt.status]}
                      className="self-start"
                    >
                      {STATUS_LABELS[appt.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
