"use client";

import { cn } from "@/lib/utils";

interface SlotChipProps {
  time: string;
  isSelected: boolean;
  onClick: () => void;
}

export function SlotChip({ time, isSelected, onClick }: SlotChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[44px] min-w-[72px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
      )}
    >
      {time}
    </button>
  );
}
