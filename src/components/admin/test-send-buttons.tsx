"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
}

function TestButton({ label, icon, action, successLabel }: TestButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? (
        <Loader2Icon className="mr-2 size-4 animate-spin" />
      ) : (
        <span className="mr-2">{icon}</span>
      )}
      {label}
    </Button>
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
      />
      <TestButton
        label="Test SMS"
        icon={<MessageSquareIcon className="size-4" />}
        action={sendTestSms}
        successLabel="SMS odoslaná — skontroluj telefón."
      />
      <TestButton
        label="Test Telegram"
        icon={<SendIcon className="size-4" />}
        action={sendTestTelegram}
        successLabel="Telegram odoslaný — skontroluj chat."
      />
    </div>
  );
}
