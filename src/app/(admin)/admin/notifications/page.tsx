import Link from "next/link";
import { format, subDays } from "date-fns";
import { sk } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RunRemindersButton } from "@/components/admin/run-reminders-button";
import {
  getNotificationLog,
  getNotificationStats,
  getProblemsSnapshot,
} from "@/server/queries/notifications";

const KIND_LABELS: Record<string, string> = {
  "email-confirmation": "Potvrdzovací email",
  "email-cancellation": "Email o zrušení",
  "email-reminder": "Pripomienka (email)",
  "sms-reminder": "Pripomienka (SMS)",
  "telegram-alert": "Telegram alert",
};

export default async function NotificationsPage() {
  const sinceMs = subDays(new Date(), 7).getTime();
  const [stats, problems, log] = await Promise.all([
    getNotificationStats({ sinceMs }),
    getProblemsSnapshot(),
    getNotificationLog({ limit: 100 }),
  ]);

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">Notifikácie</span>
      </nav>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Notifikácie</h1>
        <RunRemindersButton />
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HealthCard
          label="Email"
          sent={stats.emailSent}
          failed={stats.emailFailed}
        />
        <HealthCard
          label="SMS"
          sent={stats.smsSent}
          failed={stats.smsFailed}
        />
        <HealthCard
          label="Telegram"
          sent={stats.telegramSent}
          failed={stats.telegramFailed}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failed (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">
              {stats.emailFailed + stats.smsFailed + stats.telegramFailed}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <Card>
          <CardContent className="pt-6 text-sm">
            <p>
              Rezervácie tejto hodiny:{" "}
              <span className="font-medium">
                {problems.globalBookingsCurrentHour}
              </span>{" "}
              <span className="text-muted-foreground">
                z hodinového limitu {problems.globalBookingsCurrentHourLimit}
              </span>
              {problems.globalBookingsCurrentHour >=
                problems.globalBookingsCurrentHourLimit * 0.8 && (
                <span className="ml-2 text-destructive">
                  ⚠ Blízko limitu — ďalšie online rezervácie môžu byť zablokované
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Audit log (posledných 100)</h2>
        <Card>
          <CardContent className="pt-6">
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Zatiaľ žiadne udalosti.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Čas</TableHead>
                    <TableHead>Druh</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Príjemca</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(e.timestamp, "d.M. HH:mm:ss", { locale: sk })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {KIND_LABELS[e.kind] ?? e.kind}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === "sent" ? "default" : "destructive"}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="break-all text-xs">
                        {e.recipient ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.appointmentId ? (
                          <Link
                            href={`/admin/reservations/${e.appointmentId}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            #{e.appointmentId.slice(0, 8)}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {e.error && (
                          <span
                            className="ml-2 text-destructive"
                            title={e.error}
                          >
                            ✗ {e.error.slice(0, 50)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function HealthCard({
  label,
  sent,
  failed,
}: {
  label: string;
  sent: number;
  failed: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label} (7d)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-primary">{sent} ✓</p>
        {failed > 0 && (
          <p className="text-sm text-destructive">{failed} ✗</p>
        )}
      </CardContent>
    </Card>
  );
}
