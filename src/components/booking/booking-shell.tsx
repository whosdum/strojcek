"use client";

import { type ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useTheme, ThemeToggle } from "@/components/theme-toggle";

export function BookingShell({ children }: { children: ReactNode }) {
  const { dark } = useTheme();

  return (
    <div
      className={cn(
        "min-h-dvh bg-background text-foreground transition-colors duration-300",
        dark && "booking-theme"
      )}
    >
      <div className="mx-auto max-w-xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        {/* Nav bar */}
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/#o-nas"
            className="flex size-9 items-center justify-center rounded-lg border border-border/40 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="O nás"
            title="O nás"
          >
            <InfoIcon className="size-4" />
          </Link>
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  );
}
