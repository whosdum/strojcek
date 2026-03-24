"use client";

import { useCallback, useSyncExternalStore } from "react";
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

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dark = theme === "dark";

  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, [dark]);

  return { dark, toggle };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg border border-border/40 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      aria-label={dark ? "Prepnúť na svetlý režim" : "Prepnúť na tmavý režim"}
    >
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  );
}
