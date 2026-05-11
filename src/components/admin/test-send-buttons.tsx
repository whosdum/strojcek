"use client";

import { useState, useTransition } from "react";
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
import {
  Loader2Icon,
  MailIcon,
  MessageSquareIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  sendTestEmail,
  sendTestSms,
  sendTestTelegram,
} from "@/server/actions/notifications";

interface TestButtonProps {
  label: string;
  icon: React.ReactNode;
  action: () => Promise<{ success: boolean; error?: string }>;
  successLabel: string;
  confirmTitle: string;
  confirmDescription: React.ReactNode;
  confirmActionLabel: string;
}

function TestButton({
  label,
  icon,
  action,
  successLabel,
  confirmTitle,
  confirmDescription,
  confirmActionLabel,
}: TestButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    setOpen(false);
    startTransition(async () => {
      try {
        const r = await action();
        if (r.success) toast.success(successLabel);
        else toast.error(r.error || "Test zlyhal.");
        router.refresh();
      } catch {
        toast.error("Test zlyhal.");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
          />
        }
      >
        {isPending ? (
          <Loader2Icon className="mr-2 size-4 animate-spin" />
        ) : (
          <span className="mr-2">{icon}</span>
        )}
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušiť</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {confirmActionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TestSendButtons() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TestButton
        label="Test email"
        icon={<MailIcon className="size-4" />}
        action={sendTestEmail}
        successLabel="Email odoslaný — skontroluj schránku."
        confirmTitle="Odoslať testovací email?"
        confirmDescription="Pošle sa skúšobný email na shop email adresu nastavenú v Business info."
        confirmActionLabel="Áno, odoslať"
      />
      <TestButton
        label="Test SMS"
        icon={<MessageSquareIcon className="size-4" />}
        action={sendTestSms}
        successLabel="SMS odoslaná — skontroluj telefón."
        confirmTitle="Odoslať testovaciu SMS?"
        confirmDescription="Pošle sa skúšobná SMS na shop telefónne číslo. Tento test spotrebuje kredit u SMSTools."
        confirmActionLabel="Áno, odoslať"
      />
      <TestButton
        label="Test Telegram"
        icon={<SendIcon className="size-4" />}
        action={sendTestTelegram}
        successLabel="Telegram odoslaný — skontroluj chat."
        confirmTitle="Odoslať testovaciu Telegram správu?"
        confirmDescription="Pošle sa skúšobná správa do Telegram chatu podľa TELEGRAM_CHAT_ID."
        confirmActionLabel="Áno, odoslať"
      />
    </div>
  );
}
