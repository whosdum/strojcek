"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2Icon, BellRingIcon } from "lucide-react";
import { toast } from "sonner";
import { runRemindersNow } from "@/server/actions/notifications";

interface Props {
  emailPending: number;
  smsPending: number;
}

export function RunRemindersButton({ emailPending, smsPending }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        const r = await runRemindersNow();
        if (!r.success) {
          toast.error(r.error || "Nepodarilo sa spustiť.");
          return;
        }
        const total =
          r.emailSent + r.emailFailed + r.smsSent + r.smsFailed;
        if (total === 0) {
          toast.success("Žiadne pripomienky na poslanie.");
        } else {
          toast.success(
            `Hotovo: email ${r.emailSent}/${r.emailSent + r.emailFailed}, SMS ${r.smsSent}/${r.smsSent + r.smsFailed}`
          );
        }
        router.refresh();
      } catch {
        toast.error("Nepodarilo sa spustiť.");
      }
    });
  };

  const nothingToSend = emailPending === 0 && smsPending === 0;

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button disabled={isPending} />}
      >
        {isPending ? (
          <Loader2Icon className="mr-2 size-4 animate-spin" />
        ) : (
          <BellRingIcon className="mr-2 size-4" />
        )}
        Spustiť reminder
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Spustiť reminder ručne?</AlertDialogTitle>
          <AlertDialogDescription>
            {nothingToSend ? (
              <>Žiadne pripomienky čakajú na odoslanie. Spustenie cronu nepošle žiadny email ani SMS.</>
            ) : (
              <>
                Naozaj chcete teraz odoslať{" "}
                <strong>
                  {emailPending} email
                  {smsPending > 0 && ` + ${smsPending} SMS`}
                </strong>
                ? Notifikácie pôjdu zákazníkom okamžite a nedajú sa stiahnuť späť.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušiť</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Áno, odoslať teraz
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
