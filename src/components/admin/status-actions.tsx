"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentStatus } from "@/server/actions/appointments";
import type { AppointmentStatus } from "@/lib/types";
import { VALID_STATUS_TRANSITIONS, STATUS_LABELS } from "@/lib/constants";
import { Loader2Icon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface StatusActionsProps {
  appointmentId: string;
  currentStatus: string;
}

export function StatusActions({ appointmentId, currentStatus }: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // Only show valid next statuses + current status
  const validNextStatuses = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
  const selectableStatuses = [currentStatus, ...validNextStatuses];

  const handleChange = (newStatus: string | null) => {
    if (!newStatus || newStatus === currentStatus) return;
    setPendingStatus(newStatus);
  };

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    const newStatus = pendingStatus;
    setPendingStatus(null);
    startTransition(async () => {
      try {
        await updateAppointmentStatus(appointmentId, newStatus as AppointmentStatus);
        toast.success("Stav bol zmenený");
        router.refresh();
      } catch {
        toast.error("Nepodarilo sa zmeniť stav");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        items={Object.fromEntries(
          selectableStatuses.map((s) => [s, STATUS_LABELS[s]])
        )}
        value={currentStatus}
        onValueChange={handleChange}
        disabled={isPending}
      >
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

      <AlertDialog open={!!pendingStatus} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmeniť stav?</AlertDialogTitle>
            <AlertDialogDescription>
              Zmeniť stav na {pendingStatus ? STATUS_LABELS[pendingStatus] : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Potvrdiť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
