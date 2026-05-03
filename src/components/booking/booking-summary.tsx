import {
  ScissorsIcon,
  UserIcon,
  CalendarIcon,
  ClockIcon,
  TimerIcon,
  BanknoteIcon,
  PhoneIcon,
  MailIcon,
} from "lucide-react";

interface BookingSummaryProps {
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  duration: number;
  price: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export function BookingSummary({
  serviceName,
  barberName,
  date,
  time,
  duration,
  price,
  contactName,
  contactPhone,
  contactEmail,
}: BookingSummaryProps) {
  const rows = [
    { icon: ScissorsIcon, label: "Služba", value: serviceName },
    { icon: UserIcon, label: "Barber", value: barberName },
    { icon: CalendarIcon, label: "Dátum", value: date },
    { icon: ClockIcon, label: "Čas", value: time },
    { icon: TimerIcon, label: "Trvanie", value: `${duration} min` },
    ...(contactName ? [{ icon: UserIcon, label: "Meno", value: contactName }] : []),
    ...(contactPhone ? [{ icon: PhoneIcon, label: "Telefón", value: contactPhone }] : []),
    ...(contactEmail ? [{ icon: MailIcon, label: "Email", value: contactEmail }] : []),
  ];

  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i}>
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
