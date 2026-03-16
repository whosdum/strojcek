import { Loader2Icon } from "lucide-react";

export default function BookingLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
