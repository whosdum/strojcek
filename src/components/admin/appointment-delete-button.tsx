"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAppointment } from "@/server/actions/appointments";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2Icon, Trash2Icon } from "lucide-react";

interface AppointmentDeleteButtonProps {
  appointmentId: string;
}

export function AppointmentDeleteButton({ appointmentId }: AppointmentDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAppointment(appointmentId);
      if (result.success) {
        router.push("/admin/reservations");
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="destructive" size="sm" className="w-full sm:w-auto" />}
      >
        <Trash2Icon className="mr-1 size-4" />
        Zmazať
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zmazať rezerváciu?</AlertDialogTitle>
          <AlertDialogDescription>
            Naozaj chcete zmazať túto rezerváciu? Táto akcia sa nedá vrátiť.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušiť</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2Icon className="mr-1 size-4 animate-spin" />}
            Zmazať
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
