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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface StatusActionsProps {
  appointmentId: string;
  currentStatus: string;
}

/** Transitions where the customer is materially harmed by an undo —
 *  cancellation kills the booking, NO_SHOW marks them as a no-show on
 *  their visit history. Both warrant a confirm + reason; other moves
 *  (e.g. CONFIRMED → IN_PROGRESS) get the lightweight confirm. */
const DESTRUCTIVE_TARGETS: ReadonlySet<string> = new Set([
  "CANCELLED",
  "NO_SHOW",
]);

const REASON_MAX_LENGTH = 500;

export function StatusActions({
  appointmentId,
  currentStatus,
}: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const validNextStatuses = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
  const selectableStatuses = [currentStatus, ...validNextStatuses];

  const handleChange = (newStatus: string | null) => {
    if (!newStatus || newStatus === currentStatus) return;
    setReason("");
    setPendingStatus(newStatus);
  };

  const isDestructive = pendingStatus
    ? DESTRUCTIVE_TARGETS.has(pendingStatus)
    : false;
  const reasonRequired = isDestructive;
  const reasonValid = !reasonRequired || reason.trim().length > 0;

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    if (!reasonValid) return;
    const newStatus = pendingStatus;
    const submittedReason = reason.trim() || undefined;
    setPendingStatus(null);
    setReason("");
    startTransition(async () => {
      try {
        const result = await updateAppointmentStatus(
          appointmentId,
          newStatus as AppointmentStatus,
          submittedReason
        );
        if (!result.success) {
          toast.error(result.error || "Nepodarilo sa zmeniť stav");
          return;
        }
        toast.success("Stav bol zmenený");
        router.refresh();
      } catch {
        toast.error("Nepodarilo sa zmeniť stav");
      }
    });
  };

  const closeDialog = (open: boolean) => {
    if (open) return;
    setPendingStatus(null);
    setReason("");
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

      <AlertDialog open={!!pendingStatus} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isDestructive
                ? `Zmeniť stav na "${
                    pendingStatus ? STATUS_LABELS[pendingStatus] : ""
                  }"?`
                : "Zmeniť stav?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDestructive
                ? "Túto zmenu zákazník uvidí v jeho histórii. Uveďte prosím dôvod — uloží sa do auditu."
                : `Zmeniť stav na ${
                    pendingStatus ? STATUS_LABELS[pendingStatus] : ""
                  }?`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isDestructive && (
            <div className="space-y-1.5">
              <Label htmlFor="status-change-reason" className="text-sm">
                Dôvod <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="status-change-reason"
                rows={3}
                maxLength={REASON_MAX_LENGTH}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  pendingStatus === "CANCELLED"
                    ? "Napr. zákazník zavolal, choroba…"
                    : "Napr. zákazník neprišiel ani po 15 min…"
                }
                aria-invalid={!reasonValid}
              />
              <div className="flex items-center justify-between">
                {!reasonValid ? (
                  <p className="text-xs text-destructive">Vyplňte dôvod.</p>
                ) : (
                  <span />
                )}
                <p
                  className={`text-xs tabular-nums text-right ${
                    reason.length > REASON_MAX_LENGTH * 0.9
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {reason.length}/{REASON_MAX_LENGTH}
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              variant={isDestructive ? "destructive" : undefined}
              onClick={(e) => {
                if (!reasonValid) {
                  e.preventDefault();
                  return;
                }
                confirmStatusChange();
              }}
              disabled={!reasonValid}
            >
              Potvrdiť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
