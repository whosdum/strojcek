"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale";
import { BookingSteps } from "@/components/booking/booking-steps";
import { BookingSummary } from "@/components/booking/booking-summary";
import { Button } from "@/components/ui/button";
import { createBooking } from "@/server/actions/booking";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";

export default function BookingConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams.get("serviceId");
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  const firstName = searchParams.get("firstName");
  const lastName = searchParams.get("lastName");
  const phone = searchParams.get("phone");
  const email = searchParams.get("email");
  const note = searchParams.get("note");

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
    appointmentId?: string;
  } | null>(null);

  // We need service/barber info for summary — fetch via a separate server action
  const [summaryData, setSummaryData] = useState<{
    serviceName: string;
    barberName: string;
    duration: number;
    price: string;
  } | null>(null);

  useEffect(() => {
    if (!serviceId || !barberId || !date || !time || !firstName || !phone || !email) {
      router.replace("/book");
      return;
    }
    // Fetch summary data
    fetch(`/api/booking-summary?serviceId=${serviceId}&barberId=${barberId}`)
      .then((r) => r.json())
      .then(setSummaryData)
      .catch(console.error);
  }, [serviceId, barberId, date, time, firstName, phone, email, router]);

  if (!serviceId || !barberId || !date || !time || !firstName || !phone || !email) {
    return null;
  }

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await createBooking({
        serviceId,
        barberId,
        date,
        time,
        firstName,
        lastName: lastName || "",
        phone,
        email,
        note: note || "",
      });
      setResult(res);
    });
  };

  const formattedDate = format(parseISO(date), "EEEE, d. MMMM yyyy", {
    locale: sk,
  });

  // Success screen
  if (result?.success) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <CheckCircle2Icon className="size-16 text-green-500" />
        <h2 className="mt-4 text-xl font-bold">Rezervácia potvrdená!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Potvrdenie sme vám odoslali na email.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Číslo rezervácie: {result.appointmentId?.slice(0, 8)}
        </p>
        <Link href="/book" className="mt-6">
          <Button variant="outline">Nová rezervácia</Button>
        </Link>
      </div>
    );
  }

  // Error screen (slot taken)
  if (result && !result.success) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <XCircleIcon className="size-16 text-destructive" />
        <h2 className="mt-4 text-xl font-bold">Chyba pri rezervácii</h2>
        <p className="mt-2 text-sm text-muted-foreground">{result.error}</p>
        <Link
          href={`/book/datetime?serviceId=${serviceId}&barberId=${barberId}`}
          className="mt-6"
        >
          <Button variant="outline">Vybrať iný termín</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <BookingSteps currentStep={5} />
      <h2 className="mb-4 text-lg font-semibold">Potvrdenie rezervácie</h2>

      {summaryData ? (
        <BookingSummary
          serviceName={summaryData.serviceName}
          barberName={summaryData.barberName}
          date={formattedDate}
          time={time}
          duration={summaryData.duration}
          price={summaryData.price}
        />
      ) : (
        <div className="rounded-lg border p-4">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-muted" />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        Rezerváciu môžete zrušiť najneskôr 2 hodiny pred termínom pomocou odkazu
        v potvrdzovacom emaile.
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-sm">
          <p>
            <span className="text-muted-foreground">Meno:</span>{" "}
            {firstName} {lastName}
          </p>
          <p>
            <span className="text-muted-foreground">Telefón:</span> {phone}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span> {email}
          </p>
          {note && (
            <p>
              <span className="text-muted-foreground">Poznámka:</span> {note}
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={handleConfirm}
        disabled={isPending}
        className="mt-6 w-full"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2Icon className="mr-2 size-4 animate-spin" />
            Potvrdzujem...
          </>
        ) : (
          "Potvrdiť rezerváciu"
        )}
      </Button>
    </>
  );
}
