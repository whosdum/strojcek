"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "lucide-react";

/** Local YYYY-MM-DD (browser tz == Europe/Bratislava for this shop). */
function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const INPUT_CLASS =
  "h-9 rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 outline-none";

interface ExportCsvButtonProps {
  type: "reservations" | "customers";
}

/**
 * Triggers a CSV download from /api/admin/export. For reservations it shows an
 * Od–Do date range (defaults: first day of the current month → today); for
 * customers it's a single button (whole list).
 *
 * Downloads via fetch + blob rather than a top-level navigation, so a non-2xx
 * response — an expired session (401) or a cleared date field (400) — shows an
 * inline message instead of yanking the admin onto a raw JSON page.
 */
export function ExportCsvButton({ type }: ExportCsvButtonProps) {
  const now = new Date();
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidRange = type === "reservations" && (!from || !to || from > to);

  const handleExport = async () => {
    if (invalidRange || busy) return;
    setError(null);
    setBusy(true);
    try {
      const qs = new URLSearchParams({ type });
      if (type === "reservations") {
        qs.set("from", from);
        qs.set("to", to);
      }
      const res = await fetch(`/api/admin/export?${qs.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Export zlyhal. Skús to znova.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const filename =
        cd?.match(/filename="?([^"]+)"?/i)?.[1] ?? `export-${type}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Sieťová chyba pri exporte.");
    } finally {
      setBusy(false);
    }
  };

  if (type === "customers") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button variant="outline" onClick={handleExport} disabled={busy}>
          <DownloadIcon className="mr-1 size-4" />
          {busy ? "Exportujem…" : "Exportovať CSV"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Od</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Do</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={invalidRange || busy}
        >
          <DownloadIcon className="mr-1 size-4" />
          {busy ? "Exportujem…" : "Exportovať CSV"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
