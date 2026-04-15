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
      aria-label={`Vybrať termín o ${time}`}
      aria-pressed={isSelected}
      className={cn(
        "inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border px-3 py-2.5 text-[15px] font-semibold tabular-nums transition-all active:scale-95 sm:min-w-[80px] sm:w-auto",
        isSelected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/40 bg-muted/30 text-foreground hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      {time}
    </button>
  );
}
