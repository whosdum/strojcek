import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { getAppointmentByToken } from "@/server/queries/tokens";
import { CancelButton } from "@/components/booking/cancel-button";
import { CANCELLABLE_STATUSES, MIN_CANCEL_HOURS } from "@/lib/constants";
import { XCircleIcon, AlertTriangleIcon, CalendarXIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { addHours, isBefore } from "date-fns";

export default async function CancelPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="booking-theme flex min-h-dvh bg-background text-foreground items-center justify-center px-4">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/15">
            <XCircleIcon className="size-8 text-destructive" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-foreground">
            Neplatný odkaz
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Odkaz na zrušenie rezervácie je neplatný alebo chýba.
          </p>
          <Link href="/book" className="mt-6 block">
            <Button variant="outline" className="w-full">
              Späť na rezerváciu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const appointment = await getAppointmentByToken(token);

  if (!appointment) {
    return (
      <div className="booking-theme flex min-h-dvh bg-background text-foreground items-center justify-center px-4">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/15">
            <XCircleIcon className="size-8 text-destructive" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-foreground">
            Rezervácia nenájdená
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Neplatný alebo expirovaný odkaz na zrušenie.
          </p>
          <Link href="/book" className="mt-6 block">
            <Button variant="outline" className="w-full">
              Nová rezervácia
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isCancellable = CANCELLABLE_STATUSES.includes(appointment.status);
  const minCancelTime = addHours(new Date(), MIN_CANCEL_HOURS);
  const tooLate = isBefore(appointment.startTime, minCancelTime);
  const alreadyCancelled = appointment.status === "CANCELLED";
  const barberName = `${appointment.barber.firstName} ${appointment.barber.lastName}`;
  const formattedDate = format(appointment.startTime, "EEEE, d. MMMM yyyy", {
    locale: sk,
  });
  const formattedTime = format(appointment.startTime, "HH:mm");

  return (
    <div className="booking-theme min-h-dvh bg-background text-foreground px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15">
            <CalendarXIcon className="size-7 text-primary" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-foreground">
            Zrušenie rezervácie
          </h1>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Služba</span>
              <span className="text-right font-medium text-foreground">
                {appointment.service.name}
              </span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Barbier</span>
              <span className="text-right font-medium text-foreground">
                {barberName}
              </span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Dátum</span>
              <span className="text-right font-medium text-foreground">
                {formattedDate}
              </span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Čas</span>
              <span className="font-medium text-foreground">
                {formattedTime}
              </span>
            </div>
          </div>
        </div>

        {alreadyCancelled && (
          <div className="mt-6 text-center">
            <AlertTriangleIcon className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Táto rezervácia už bola zrušená.
            </p>
            <Link href="/book" className="mt-4 block">
              <Button variant="outline" className="w-full">
                Nová rezervácia
              </Button>
            </Link>
          </div>
        )}

        {!isCancellable && !alreadyCancelled && (
          <div className="mt-6 text-center">
            <AlertTriangleIcon className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Túto rezerváciu nie je možné zrušiť (stav:{" "}
              {appointment.status}).
            </p>
          </div>
        )}

        {isCancellable && tooLate && (
          <div className="mt-6 text-center">
            <AlertTriangleIcon className="mx-auto size-10 text-amber-400" />
            <p className="mt-2 text-sm text-muted-foreground">
              Rezerváciu je možné zrušiť najneskôr {MIN_CANCEL_HOURS} hodiny
              pred termínom.
            </p>
          </div>
        )}

        {isCancellable && !tooLate && (
          <div className="mt-6">
            <CancelButton token={token} />
          </div>
        )}
      </div>
    </div>
  );
}
