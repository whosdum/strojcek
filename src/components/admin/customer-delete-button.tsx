"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomer } from "@/server/actions/customers";
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

interface CustomerDeleteButtonProps {
  customerId: string;
  customerName: string;
}

export function CustomerDeleteButton({ customerId, customerName }: CustomerDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteCustomer(customerId);
      if (result.success) {
        router.push("/admin/customers");
      } else {
        setError(result.error || "Nastala chyba.");
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
          <AlertDialogTitle>Zmazať zákazníka?</AlertDialogTitle>
          <AlertDialogDescription>
            Naozaj chcete zmazať zákazníka <strong>{customerName}</strong>?
            Existujúce rezervácie zostanú zachované, ale nebudú prepojené na zákazníka.
            Táto akcia sa nedá vrátiť.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
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
