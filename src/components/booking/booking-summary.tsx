import {
  ScissorsIcon,
  UserIcon,
  CalendarIcon,
  ClockIcon,
  TimerIcon,
  BanknoteIcon,
} from "lucide-react";

interface BookingSummaryProps {
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  duration: number;
  price: string;
}

export function BookingSummary({
  serviceName,
  barberName,
  date,
  time,
  duration,
  price,
}: BookingSummaryProps) {
  const rows = [
    { icon: ScissorsIcon, label: "Služba", value: serviceName },
    { icon: UserIcon, label: "Barbier", value: barberName },
    { icon: CalendarIcon, label: "Dátum", value: date },
    { icon: ClockIcon, label: "Čas", value: time },
    { icon: TimerIcon, label: "Trvanie", value: `${duration} min` },
  ];

  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={row.label}>
            <div className="flex items-center gap-3 text-[15px]">
              <row.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{row.label}</span>
              <span className="ml-auto text-right font-medium text-foreground">
                {row.value}
              </span>
            </div>
            {i < rows.length - 1 && (
              <div className="ml-7 mt-3 h-px bg-border/40" />
            )}
          </div>
        ))}

        {/* Price row — highlighted */}
        <div className="ml-7 h-px bg-border/40" />
        <div className="flex items-center gap-3 text-[15px]">
          <BanknoteIcon className="size-4 shrink-0 text-primary" />
          <span className="font-semibold text-foreground">Cena</span>
          <span className="ml-auto text-lg font-bold text-primary tabular-nums">
            {price} €
          </span>
        </div>
      </div>
    </div>
  );
}
