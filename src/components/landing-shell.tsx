"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTheme, ThemeToggle } from "@/components/theme-toggle";

export function LandingShell({ children }: { children: ReactNode }) {
  const { dark } = useTheme();

  return (
    <div
      className={cn(
        "min-h-dvh bg-background text-foreground transition-colors duration-300",
        dark && "dark"
      )}
    >
      {/* Theme toggle — fixed top right */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
