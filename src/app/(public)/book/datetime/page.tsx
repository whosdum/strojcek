"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, isBefore, startOfDay } from "date-fns";
import { sk } from "date-fns/locale";
import { BookingSteps } from "@/components/booking/booking-steps";
import { TimeSlots } from "@/components/booking/time-slots";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { fetchSlots, fetchWorkingDays } from "@/server/actions/slots";
import { Loader2Icon } from "lucide-react";

export default function BookingDateTimePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams.get("serviceId");
  const barberId = searchParams.get("barberId");

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!serviceId || !barberId) {
      router.replace("/book");
    }
  }, [serviceId, barberId, router]);

  useEffect(() => {
    if (!barberId) return;
    fetchWorkingDays(barberId).then(setWorkingDays);
  }, [barberId]);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      setSelectedDate(date);
      setSelectedTime(null);
      if (!date || !barberId || !serviceId) {
        setSlots([]);
        return;
      }
      const dateStr = format(date, "yyyy-MM-dd");
      startTransition(async () => {
        const available = await fetchSlots(barberId, serviceId, dateStr);
        setSlots(available);
      });
    },
    [barberId, serviceId]
  );

  const handleContinue = () => {
    if (!selectedDate || !selectedTime) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const params = new URLSearchParams({
      serviceId: serviceId!,
      barberId: barberId!,
      date: dateStr,
      time: selectedTime,
    });
    router.push(`/book/details?${params.toString()}`);
  };

  const today = startOfDay(new Date());

  const isDisabledDate = (date: Date) => {
    if (isBefore(date, today)) return true;
    if (workingDays.length > 0 && !workingDays.includes(date.getDay())) return true;
    return false;
  };

  if (!serviceId || !barberId) return null;

  return (
    <>
      <BookingSteps currentStep={3} />
      <h2 className="mb-4 text-lg font-semibold">Vyberte dátum a čas</h2>

      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={isDisabledDate}
          locale={sk}
          weekStartsOn={1}
        />
      </div>

      {selectedDate && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium">
            {format(selectedDate, "EEEE, d. MMMM yyyy", { locale: sk })}
          </h3>
          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TimeSlots
              slots={slots}
              selectedTime={selectedTime}
              onSelect={setSelectedTime}
            />
          )}
        </div>
      )}

      {selectedTime && (
        <div className="mt-6">
          <Button onClick={handleContinue} className="w-full" size="lg">
            Pokračovať
          </Button>
        </div>
      )}
    </>
  );
}
