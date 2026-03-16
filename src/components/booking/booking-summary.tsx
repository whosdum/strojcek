import { Separator } from "@/components/ui/separator";

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
  return (
    <div className="rounded-lg border p-4">
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Služba</span>
          <span className="font-medium">{serviceName}</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Barbier</span>
          <span className="font-medium">{barberName}</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Dátum</span>
          <span className="font-medium">{date}</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Čas</span>
          <span className="font-medium">{time}</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Trvanie</span>
          <span className="font-medium">{duration} min</span>
        </div>
        <Separator />
        <div className="flex justify-between text-base">
          <span className="font-medium">Cena</span>
          <span className="font-bold">{price} €</span>
        </div>
      </div>
    </div>
  );
}
