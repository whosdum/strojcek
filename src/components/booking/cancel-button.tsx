"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cancelBooking } from "@/server/actions/booking";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";

export function CancelButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const handleCancel = () => {
    startTransition(async () => {
      const res = await cancelBooking(token);
      setResult(res);
    });
  };

  if (result?.success) {
    return (
      <div className="mt-6 flex flex-col items-center text-center">
        <CheckCircle2Icon className="size-12 text-green-500" />
        <p className="mt-2 font-semibold">Rezervácia bola zrušená.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Potvrdenie sme vám odoslali na email.
        </p>
        <Link href="/book" className="mt-4">
          <Button variant="outline">Nová rezervácia</Button>
        </Link>
      </div>
    );
  }

  if (result && !result.success) {
    return (
      <div className="mt-6 flex flex-col items-center text-center">
        <XCircleIcon className="size-12 text-destructive" />
        <p className="mt-2 text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-3 text-center text-sm text-muted-foreground">
        Naozaj chcete zrušiť túto rezerváciu?
      </p>
      <Button
        onClick={handleCancel}
        disabled={isPending}
        variant="destructive"
        className="w-full"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2Icon className="mr-2 size-4 animate-spin" />
            Ruším...
          </>
        ) : (
          "Zrušiť rezerváciu"
        )}
      </Button>
    </div>
  );
}
