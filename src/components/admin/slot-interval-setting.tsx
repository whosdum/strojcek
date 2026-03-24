"use client";

import { useState, useTransition } from "react";
import { updateSlotInterval } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hod" },
];

interface SlotIntervalSettingProps {
  currentInterval: number;
}

export function SlotIntervalSetting({
  currentInterval,
}: SlotIntervalSettingProps) {
  const [selected, setSelected] = useState(currentInterval);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (selected === currentInterval) return;
    startTransition(async () => {
      const result = await updateSlotInterval(selected);
      if (result.success) {
        toast.success("Interval termínov bol aktualizovaný.");
      } else {
        toast.error(result.error || "Nastala chyba.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Interval termínov</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Nastavte časový interval medzi dostupnými termínmi pre zákazníkov.
        </p>
        <div className="flex flex-wrap gap-2">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                selected === opt.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {selected !== currentInterval && (
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="mt-4"
            size="sm"
          >
            {isPending ? "Ukladám..." : "Uložiť"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
