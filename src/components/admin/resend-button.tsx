"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
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

  const handleClick = () => {
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
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? (
        <Loader2Icon className="mr-1.5 size-4 animate-spin" />
      ) : (
        <SendIcon className="mr-1.5 size-4" />
      )}
      {label}
    </Button>
  );
}
