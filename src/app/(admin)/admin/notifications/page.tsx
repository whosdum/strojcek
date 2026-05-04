import Link from "next/link";
import { format, subDays, formatDistanceToNow } from "date-fns";
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
import { TestSendButtons } from "@/components/admin/test-send-buttons";
import {
  getLastCronRun,
  getNotificationLog,
  getNotificationStats,
  getProblemsSnapshot,
  getTomorrowRemindersPreview,
} from "@/server/queries/notifications";
import type {
  NotificationKind,
  NotificationStatus,
} from "@/lib/types";

const KIND_LABELS: Record<string, string> = {
  "email-confirmation": "Potvrdzovací email",
  "email-cancellation": "Email o zrušení",
  "email-reminder": "Pripomienka (email)",
  "sms-reminder": "Pripomienka (SMS)",
  "telegram-alert": "Telegram alert",
};

const STATUS_VALUES: NotificationStatus[] = ["sent", "failed"];
const KIND_FILTERS: Array<{ value: NotificationKind | "email"; label: string }> = [
  { value: "email", label: "Email" },
  { value: "sms-reminder", label: "SMS" },
  { value: "telegram-alert", label: "Telegram" },
];

/** "Reminder cron je staršia ako N hodín → varovať." Reminder beží denne
 *  o 16:00 UTC; po >25h od posledného úspešného behu niečo zlyhalo. */
const CRON_STALE_HOURS = 25;

interface PageProps {
  searchParams: Promise<{
    status?: string;
    kind?: string;
    q?: string;
  }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusFilter = STATUS_VALUES.includes(params.status as NotificationStatus)
    ? (params.status as NotificationStatus)
    : undefined;
  const kindParam = params.kind;
  const recipientQuery = params.q?.trim() || undefined;

  // Map "email" pseudo-filter to the union of confirmation+cancellation+reminder.
  // Server-side query takes only one kind, so we apply post-filter via JS for
  // the grouped "email" choice.
  const isKindGroupEmail = kindParam === "email";
  const kindFilter: NotificationKind | undefined =
    !isKindGroupEmail && kindParam && kindParam !== "all"
      ? (kindParam as NotificationKind)
      : undefined;

  const sinceMs = subDays(new Date(), 7).getTime();
  const [stats, problems, lastCron, tomorrow, rawLog] = await Promise.all([
    getNotificationStats({ sinceMs }),
    getProblemsSnapshot(),
    getLastCronRun(),
    getTomorrowRemindersPreview(),
    getNotificationLog({
      limit: 100,
      status: statusFilter,
      kind: kindFilter,
      recipient: recipientQuery,
    }),
  ]);

  const log = isKindGroupEmail
    ? rawLog.filter((e) => e.kind.startsWith("email-"))
    : rawLog;

  const cronStale =
    lastCron.ageMs == null ||
    lastCron.ageMs > CRON_STALE_HOURS * 60 * 60 * 1000;

  const filtersActive = !!(statusFilter || kindParam || recipientQuery);
  const buildFilterUrl = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    if (statusFilter) next.set("status", statusFilter);
    if (kindParam) next.set("kind", kindParam);
    if (recipientQuery) next.set("q", recipientQuery);
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `/admin/notifications?${qs}` : "/admin/notifications";
  };

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">Notifikácie</span>
      </nav>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Notifikácie</h1>
        <div className="flex flex-col items-end gap-1">
          <RunRemindersButton />
          {(tomorrow.emailPending > 0 || tomorrow.smsPending > 0) && (
            <p className="text-xs text-muted-foreground">
              Zajtra ({tomorrow.dateKey}) sa pošle:{" "}
              <span className="font-medium text-foreground">
                {tomorrow.emailPending} email
                {tomorrow.smsPending > 0 && ` + ${tomorrow.smsPending} SMS`}
              </span>
            </p>
          )}
          {tomorrow.emailPending === 0 && tomorrow.smsPending === 0 && (
            <p className="text-xs text-muted-foreground">
              Zajtra ({tomorrow.dateKey}) — žiadne pripomienky.
            </p>
          )}
        </div>
      </div>

      {/* Cron health banner */}
      <section className="mb-4">
        <Card
          className={
            cronStale
              ? "border-destructive/40 bg-destructive/5"
              : "border-emerald-500/40 bg-emerald-500/5"
          }
        >
          <CardContent className="pt-5 text-sm">
            {lastCron.lastRunAt ? (
              <p>
                <span className="font-medium">Reminder cron:</span>{" "}
                {cronStale ? (
                  <span className="text-destructive">
                    ⚠ Posledný beh pred{" "}
                    {formatDistanceToNow(lastCron.lastRunAt, { locale: sk })}{" "}
                    — skontroluj GitHub Actions
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    ✓ pred{" "}
                    {formatDistanceToNow(lastCron.lastRunAt, { locale: sk })} (
                    {lastCron.lastRunStatus === "sent" ? "OK" : "s chybami"})
                  </span>
                )}{" "}
                <span className="text-muted-foreground">
                  · {format(lastCron.lastRunAt, "d.M.yyyy HH:mm", { locale: sk })}
                </span>
              </p>
            ) : (
              <p className="text-destructive">
                ⚠ Reminder cron ešte nikdy nezbehol (alebo všetky záznamy už
                expirovali). Skontroluj GitHub Actions workflow.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

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
        <Link
          href={buildFilterUrl({ status: "failed" })}
          className="block"
        >
          <Card className="cursor-pointer transition-colors hover:bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Failed (7d)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-destructive">
                {stats.emailFailed + stats.smsFailed + stats.telegramFailed}
              </p>
              <p className="text-xs text-muted-foreground">
                Klik → zobraziť zlyhané
              </p>
            </CardContent>
          </Card>
        </Link>
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

      <section className="mb-6">
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex flex-col gap-1">
              <p className="font-medium">Test odoslania</p>
              <p className="text-xs text-muted-foreground">
                Pošle skúšobnú správu na shop email / telefón / Telegram chat
                — užitočné po výmene secrets.
              </p>
            </div>
            <TestSendButtons />
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <form
            method="GET"
            action="/admin/notifications"
            className="flex w-full gap-2 sm:w-auto"
          >
            {statusFilter && (
              <input type="hidden" name="status" value={statusFilter} />
            )}
            {kindParam && <input type="hidden" name="kind" value={kindParam} />}
            <input
              name="q"
              type="search"
              defaultValue={recipientQuery ?? ""}
              placeholder="Hľadaj podľa emailu / telefónu"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-64"
            />
            <button
              type="submit"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm hover:bg-muted/50"
            >
              Hľadať
            </button>
          </form>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <Link href={buildFilterUrl({ status: undefined })}>
            <Badge variant={!statusFilter ? "default" : "outline"}>
              Všetky stavy
            </Badge>
          </Link>
          <Link href={buildFilterUrl({ status: "sent" })}>
            <Badge variant={statusFilter === "sent" ? "default" : "outline"}>
              ✓ Úspešné
            </Badge>
          </Link>
          <Link href={buildFilterUrl({ status: "failed" })}>
            <Badge variant={statusFilter === "failed" ? "default" : "outline"}>
              ✗ Zlyhané
            </Badge>
          </Link>

          <span className="mx-2 self-center text-muted-foreground">·</span>

          <Link href={buildFilterUrl({ kind: undefined })}>
            <Badge variant={!kindParam ? "default" : "outline"}>
              Všetky druhy
            </Badge>
          </Link>
          {KIND_FILTERS.map((k) => (
            <Link key={k.value} href={buildFilterUrl({ kind: k.value })}>
              <Badge variant={kindParam === k.value ? "default" : "outline"}>
                {k.label}
              </Badge>
            </Link>
          ))}

          {filtersActive && (
            <Link
              href="/admin/notifications"
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Vyčistiť filter
            </Link>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {filtersActive
                  ? "Žiadne udalosti zodpovedajúce filtru."
                  : "Zatiaľ žiadne udalosti."}
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
