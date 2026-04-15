"use client";

import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CancelError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircleIcon className="size-8 text-destructive" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">
          Niečo sa pokazilo
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Nepodarilo sa načítať údaje o rezervácii. Skúste to prosím znova.
        </p>
        <Button className="mt-6" size="lg" onClick={reset}>
          Skúsiť znova
        </Button>
      </div>
    </div>
  );
}
