"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Tiny error boundary around the FullCalendar widget. If the calendar
 * bundle fails to load (transient CDN error, broken plugin upgrade) or
 * the widget throws on render, this fallback gives the admin a clear
 * message + a way out instead of a blank page. Reload here re-fetches
 * the JS chunks too.
 */
export class CalendarErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[admin-calendar] render failed:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-10 text-center"
      >
        <AlertCircleIcon className="size-7 text-destructive" />
        <p className="font-medium text-destructive">
          Kalendár sa nepodarilo zobraziť.
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Skúste obnoviť stránku. Ak chyba pretrváva, otvorte rezervácie
          z hlavného menu.
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Obnoviť stránku
        </Button>
      </div>
    );
  }
}
