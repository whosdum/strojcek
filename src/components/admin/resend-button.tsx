"use client";

import { useState, useTransition } from "react";
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
import { Loader2Icon, SendIcon } from "lucide-react";
import { toast } from "sonner";

interface ResendButtonProps {
  action: () => Promise<{ success: boolean; error?: string }>;
  label?: string;
  successMessage?: string;
}

export function ResendButton({
  action,
  label = "Resend",
  successMessage = "Odoslané",
}: ResendButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    setOpen(false);
    startTransition(async () => {
      try {
        const r = await action();
        if (r.success) toast.success(successMessage);
        else toast.error(r.error || "Nepodarilo sa odoslať.");
      } catch {
        toast.error("Nepodarilo sa odoslať.");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" size="sm" variant="outline" disabled={isPending} />
        }
      >
        {isPending ? (
          <Loader2Icon className="mr-1.5 size-4 animate-spin" />
        ) : (
          <SendIcon className="mr-1.5 size-4" />
        )}
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ste si istý?</AlertDialogTitle>
          <AlertDialogDescription>
            Notifikácia pôjde zákazníkovi okamžite a nedá sa stiahnuť späť.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušiť</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Áno, odoslať
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
