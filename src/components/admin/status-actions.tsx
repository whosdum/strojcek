"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateAppointmentStatus } from "@/server/actions/appointments";
import { VALID_STATUS_TRANSITIONS } from "@/lib/constants";
import { AppointmentStatus } from "@/generated/prisma/client";
import { Loader2Icon } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CONFIRMED: { label: "Potvrdiť", variant: "default" },
  IN_PROGRESS: { label: "Začať", variant: "secondary" },
  COMPLETED: { label: "Dokončiť", variant: "default" },
  CANCELLED: { label: "Zrušiť", variant: "destructive" },
  NO_SHOW: { label: "Neprišiel", variant: "destructive" },
};

interface StatusActionsProps {
  appointmentId: string;
  currentStatus: string;
}

export function StatusActions({ appointmentId, currentStatus }: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];

  if (validTransitions.length === 0) {
    return <p className="text-sm text-muted-foreground">Žiadne dostupné akcie.</p>;
  }

  const handleTransition = (newStatus: string) => {
    startTransition(async () => {
      await updateAppointmentStatus(appointmentId, newStatus as AppointmentStatus);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {validTransitions.map((status) => {
        const action = ACTION_LABELS[status];
        if (!action) return null;
        return (
          <Button
            key={status}
            variant={action.variant}
            size="sm"
            disabled={isPending}
            onClick={() => handleTransition(status)}
          >
            {isPending ? (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            ) : null}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
