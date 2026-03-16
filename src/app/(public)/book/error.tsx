"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangleIcon } from "lucide-react";

export default function BookingError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <AlertTriangleIcon className="size-12 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold">Nastala chyba</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Skúste to prosím znova.
      </p>
      <Button onClick={reset} variant="outline" className="mt-4">
        Skúsiť znova
      </Button>
    </div>
  );
}
