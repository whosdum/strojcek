"use client";

import { type ReactNode, type MouseEvent } from "react";
import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, ThemeToggle } from "@/components/theme-toggle";

interface BookingShellProps {
  children: ReactNode;
}

function handleAboutClick(e: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById("o-barbershope");
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", "#o-barbershope");
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
        <div className="flex items-center justify-between gap-2">
          <a
            href="#o-barbershope"
            onClick={handleAboutClick}
            aria-label="O nás — kontakt a otváracie hodiny"
            className="flex size-9 items-center justify-center rounded-lg border border-border/40 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <InfoIcon className="size-4" />
          </a>
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  );
}
