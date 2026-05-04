"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2Icon, BellRingIcon } from "lucide-react";
import { toast } from "sonner";
import { runRemindersNow } from "@/server/actions/notifications";

export function RunRemindersButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const r = await runRemindersNow();
        if (!r.success) {
          toast.error(r.error || "Nepodarilo sa spustiť.");
          return;
        }
        toast.success(
          `Hotovo: email ${r.emailSent}/${r.emailSent + r.emailFailed}, SMS ${r.smsSent}/${r.smsSent + r.smsFailed}`
        );
        router.refresh();
      } catch {
        toast.error("Nepodarilo sa spustiť.");
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? (
        <Loader2Icon className="mr-2 size-4 animate-spin" />
      ) : (
        <BellRingIcon className="mr-2 size-4" />
      )}
      Spustiť reminder
    </Button>
  );
}
