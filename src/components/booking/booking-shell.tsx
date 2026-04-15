"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTheme, ThemeToggle } from "@/components/theme-toggle";

interface BookingShellProps {
  children: ReactNode;
}

export function BookingShell({ children }: BookingShellProps) {
  const { dark } = useTheme();

  return (
    <div
      className={cn(
        "min-h-dvh bg-background text-foreground transition-colors duration-300",
        dark && "booking-theme"
      )}
    >
      <div className="mx-auto max-w-xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  );
}
