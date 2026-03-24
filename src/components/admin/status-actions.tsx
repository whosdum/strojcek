"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentStatus } from "@/server/actions/appointments";
import { AppointmentStatus } from "@/generated/prisma/client";
import { VALID_STATUS_TRANSITIONS } from "@/lib/constants";
import { Loader2Icon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čakajúca",
  CONFIRMED: "Potvrdená",
  IN_PROGRESS: "Prebieha",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
  NO_SHOW: "Neprišiel",
};

interface StatusActionsProps {
  appointmentId: string;
  currentStatus: string;
}

export function StatusActions({ appointmentId, currentStatus }: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Only show valid next statuses + current status
  const validNextStatuses = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
  const selectableStatuses = [currentStatus, ...validNextStatuses];

  const handleChange = (newStatus: string | null) => {
    if (!newStatus || newStatus === currentStatus) return;
    startTransition(async () => {
      await updateAppointmentStatus(appointmentId, newStatus as AppointmentStatus);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={currentStatus} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-[180px]">
          {isPending ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : null}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {selectableStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
