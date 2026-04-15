import Image from "next/image";
import Link from "next/link";
import { sk } from "date-fns/locale";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { getAppointmentByToken } from "@/server/queries/tokens";
import { BookingShell } from "@/components/booking/booking-shell";
import { CancelButton } from "@/components/booking/cancel-button";
import { CANCELLABLE_STATUSES, MIN_CANCEL_HOURS, TIMEZONE } from "@/lib/constants";
import { XCircleIcon, AlertTriangleIcon, CalendarXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addHours, isBefore } from "date-fns";

function CancelPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <BookingShell>
      <header className="mb-8 flex flex-col items-center text-center sm:mb-10">
        <Link href="/" className="inline-flex">
          <Image
            src="/logo.jpg"
            alt="Strojček"
            width={120}
            height={65}
            className="rounded-xl shadow-lg shadow-black/15"
            priority
          />
        </Link>
        <p className="mt-3 text-[13px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Strojček
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Zrušenie rezervácie
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Skontrolujte svoj termín a v prípade potreby ho zrušte online.
        </p>
      </header>

      <div className="mx-auto max-w-md">{children}</div>

      <footer className="mt-10 border-t border-border/40 pt-6 text-center text-[13px] text-muted-foreground">
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/vop"
            prefetch={false}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Obchodné podmienky
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/ochrana-udajov"
            prefetch={false}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Ochrana osobných údajov
          </Link>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} STROJČEK s.r.o.</p>
      </footer>
    </BookingShell>
  );
}

export default async function CancelPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <CancelPageFrame>
        <div className="rounded-3xl border border-border/60 bg-card/90 p-6 text-center shadow-sm shadow-black/5">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/15">
            <XCircleIcon className="size-8 text-destructive" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">
            Neplatný odkaz
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Odkaz na zrušenie rezervácie je neplatný alebo chýba.
          </p>
          <Link href="/" className="mt-6 block">
            <Button variant="outline" className="w-full">
              Späť na rezerváciu
            </Button>
          </Link>
        </div>
      </CancelPageFrame>
    );
  }

  const appointment = await getAppointmentByToken(token);

  if (!appointment) {
    return (
      <CancelPageFrame>
        <div className="rounded-3xl border border-border/60 bg-card/90 p-6 text-center shadow-sm shadow-black/5">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/15">
            <XCircleIcon className="size-8 text-destructive" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">
            Rezervácia nenájdená
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Neplatný alebo expirovaný odkaz na zrušenie.
          </p>
          <Link href="/" className="mt-6 block">
            <Button variant="outline" className="w-full">
              Nová rezervácia
            </Button>
          </Link>
        </div>
      </CancelPageFrame>
    );
  }

  const isCancellable = CANCELLABLE_STATUSES.includes(appointment.status);
  const minCancelTime = addHours(new Date(), MIN_CANCEL_HOURS);
  const tooLate = isBefore(appointment.startTime, minCancelTime);
  const alreadyCancelled = appointment.status === "CANCELLED";
  const barberName = `${appointment.barber.firstName} ${appointment.barber.lastName}`;
  const formattedDate = formatInTimeZone(appointment.startTime, TIMEZONE, "EEEE, d. MMMM yyyy", {
    locale: sk,
  });
  const formattedTime = formatInTimeZone(appointment.startTime, TIMEZONE, "HH:mm");

  return (
    <CancelPageFrame>
      <div className="space-y-6">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/12">
            <CalendarXIcon className="size-7 text-primary" />
          </div>
          <h2 className="mt-3 text-xl font-bold text-foreground">
            Zrušenie rezervácie
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pred potvrdením si ešte raz skontrolujte vybraný termín.
          </p>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm shadow-black/5">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Služba</span>
              <span className="text-right font-medium text-foreground">
                {appointment.service.name}
              </span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Barber</span>
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
            <Link href="/" className="mt-4 block">
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
    </CancelPageFrame>
  );
}
