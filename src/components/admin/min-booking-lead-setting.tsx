"use client";

import { useState, useTransition } from "react";
import { updateMinBookingLead } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LEAD_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hod" },
  { value: 120, label: "2 hod" },
  { value: 180, label: "3 hod" },
];

interface MinBookingLeadSettingProps {
  currentLead: number;
}

export function MinBookingLeadSetting({
  currentLead,
}: MinBookingLeadSettingProps) {
  const [selected, setSelected] = useState(currentLead);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (selected === currentLead) return;
    startTransition(async () => {
      const result = await updateMinBookingLead(selected);
      if (result.success) {
        toast.success("Minimálny čas pred rezerváciou bol aktualizovaný.");
      } else {
        toast.error(result.error || "Nastala chyba.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Minimálny čas pred rezerváciou</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Ako dlho vopred si musí zákazník online rezervovať termín. V admine môžete zapísať aj termín hneď teraz.
        </p>
        <div className="flex flex-wrap gap-2">
          {LEAD_OPTIONS.map((opt) => (
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
        {selected !== currentLead && (
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
