"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { SunIcon, MoonIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "strojcek-theme";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) ?? "light";
}

function getServerSnapshot() {
  return "light";
}

export function BookingShell({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dark = theme === "dark";

  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, [dark]);

  return (
    <div
      className={cn(
        "min-h-dvh bg-background text-foreground transition-colors duration-300",
        dark && "booking-theme"
      )}
    >
      <div className="mx-auto max-w-xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        {/* Theme toggle */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggle}
            className="flex size-9 items-center justify-center rounded-lg border border-border/40 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={dark ? "Prepnúť na svetlý režim" : "Prepnúť na tmavý režim"}
          >
            {dark ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
