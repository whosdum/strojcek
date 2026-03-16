import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { getAppointmentByToken } from "@/server/queries/tokens";
import { CancelButton } from "@/components/booking/cancel-button";
import { CANCELLABLE_STATUSES, MIN_CANCEL_HOURS } from "@/lib/constants";
import { XCircleIcon, AlertTriangleIcon } from "lucide-react";
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
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <XCircleIcon className="size-16 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">Neplatný odkaz</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Odkaz na zrušenie rezervácie je neplatný alebo chýba.
        </p>
        <Link href="/book" className="mt-6">
          <Button variant="outline">Späť na rezerváciu</Button>
        </Link>
      </div>
    );
  }

  const appointment = await getAppointmentByToken(token);

  if (!appointment) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <XCircleIcon className="size-16 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">Rezervácia nenájdená</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Neplatný alebo expirovaný odkaz na zrušenie.
        </p>
        <Link href="/book" className="mt-6">
          <Button variant="outline">Nová rezervácia</Button>
        </Link>
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
    <div className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-bold">Zrušenie rezervácie</h1>

      <div className="rounded-lg border p-4 text-sm">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Služba</span>
            <span className="font-medium">{appointment.service.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Barbier</span>
            <span className="font-medium">{barberName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dátum</span>
            <span className="font-medium">{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Čas</span>
            <span className="font-medium">{formattedTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stav</span>
            <span className="font-medium">{appointment.status}</span>
          </div>
        </div>
      </div>

      {alreadyCancelled && (
        <div className="mt-6 flex flex-col items-center text-center">
          <AlertTriangleIcon className="size-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Táto rezervácia už bola zrušená.
          </p>
          <Link href="/book" className="mt-4">
            <Button variant="outline">Nová rezervácia</Button>
          </Link>
        </div>
      )}

      {!isCancellable && !alreadyCancelled && (
        <div className="mt-6 flex flex-col items-center text-center">
          <AlertTriangleIcon className="size-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Túto rezerváciu nie je možné zrušiť (stav: {appointment.status}).
          </p>
        </div>
      )}

      {isCancellable && tooLate && (
        <div className="mt-6 flex flex-col items-center text-center">
          <AlertTriangleIcon className="size-10 text-amber-500" />
          <p className="mt-2 text-sm text-muted-foreground">
            Rezerváciu je možné zrušiť najneskôr {MIN_CANCEL_HOURS} hodiny pred
            termínom.
          </p>
        </div>
      )}

      {isCancellable && !tooLate && <CancelButton token={token} />}
    </div>
  );
}
