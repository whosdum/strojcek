"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SHOP_EMAIL, SHOP_PHONE_E164 } from "@/lib/business-info";

interface TestButtonProps {
  label: string;
  icon: React.ReactNode;
  action: (recipient?: string) => Promise<{ success: boolean; error?: string }>;
  successLabel: string;
  confirmTitle: string;
  confirmDescription: React.ReactNode;
  confirmActionLabel: string;
  /** Editable recipient field, prefilled with the shop contact. */
  recipient?: { label: string; type: "email" | "tel"; defaultValue: string };
}

function TestButton({
  label,
  icon,
  action,
  successLabel,
  confirmTitle,
  confirmDescription,
  confirmActionLabel,
  recipient,
}: TestButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(recipient?.defaultValue ?? "");

  const handleOpenChange = (next: boolean) => {
    // Each open starts from the shop contact again.
    if (next) setValue(recipient?.defaultValue ?? "");
    setOpen(next);
  };

  const handleConfirm = () => {
    setOpen(false);
    startTransition(async () => {
      try {
        const r = await action(recipient ? value : undefined);
        if (r.success) toast.success(successLabel);
        else toast.error(r.error || "Test zlyhal.");
        router.refresh();
      } catch {
        toast.error("Test zlyhal.");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
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
        {recipient && (
          <div className="space-y-1.5">
            <Label htmlFor={`test-recipient-${recipient.type}`}>{recipient.label}</Label>
            <Input
              id={`test-recipient-${recipient.type}`}
              type={recipient.type}
              inputMode={recipient.type === "tel" ? "tel" : "email"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
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
        confirmDescription="Pošle sa skúšobný email. Predvolená je shop email adresa, môžete ju zmeniť."
        confirmActionLabel="Áno, odoslať"
        recipient={{ label: "Email", type: "email", defaultValue: SHOP_EMAIL }}
      />
      <TestButton
        label="Test SMS"
        icon={<MessageSquareIcon className="size-4" />}
        action={sendTestSms}
        successLabel="SMS odoslaná — skontroluj telefón."
        confirmTitle="Odoslať testovaciu SMS?"
        confirmDescription="Pošle sa skúšobná SMS. Predvolené je shop telefónne číslo, môžete ho zmeniť. Tento test spotrebuje kredit u SMSTools."
        confirmActionLabel="Áno, odoslať"
        recipient={{ label: "Telefónne číslo", type: "tel", defaultValue: SHOP_PHONE_E164 }}
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
