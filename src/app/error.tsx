"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BookingShell } from "@/components/booking/booking-shell";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <BookingShell>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Niečo sa pokazilo
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nepodarilo sa načítať rezervačný systém. Skúste to prosím znova.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Skúsiť znova
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Späť na domovskú stránku
          </Link>
        </div>
      </div>
    </BookingShell>
  );
}
