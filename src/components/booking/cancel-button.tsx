"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelBooking } from "@/server/actions/booking";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";

export function CancelButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const handleCancel = () => {
    startTransition(async () => {
      const res = await cancelBooking({ token, reason });
      setResult(res);
    });
  };

  if (result?.success) {
    return (
      <div className="mt-6 flex flex-col items-center text-center">
        <CheckCircle2Icon className="size-12 text-green-500" />
        <p className="mt-2 font-semibold">Rezervácia bola zrušená.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ak ste zadali email, potvrdenie sme vám odoslali.
        </p>
        <Link href="/book" className="mt-4">
          <Button variant="outline">Nová rezervácia</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm shadow-black/5">
        <p className="text-center text-sm text-muted-foreground">
          Naozaj chcete zrušiť túto rezerváciu?
        </p>
        <div className="mt-4 space-y-1.5">
          <Label
            htmlFor="cancellationReason"
            className="text-[15px] font-medium text-foreground"
          >
            Dôvod zrušenia
          </Label>
          <Textarea
            id="cancellationReason"
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isPending}
            placeholder="Voliteľné. Napr. zmena plánov, choroba alebo presun termínu."
            className="bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
          />
          <p className="text-xs text-muted-foreground">
            Voliteľné. Ak ho vyplníte, uloží sa k zrušenej rezervácii.
          </p>
        </div>
      </div>

      {result && !result.success && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
          <XCircleIcon className="mx-auto size-10 text-destructive" />
          <p className="mt-2 text-sm text-destructive">{result.error}</p>
        </div>
      )}

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
