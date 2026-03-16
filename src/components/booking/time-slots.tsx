"use client";

import { SLOT_GROUP_BOUNDARIES } from "@/lib/constants";
import { SlotChip } from "./slot-chip";

interface TimeSlotsProps {
  slots: string[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
}

export function TimeSlots({ slots, selectedTime, onSelect }: TimeSlotsProps) {
  if (slots.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Na vybraný deň nie sú dostupné žiadne termíny.
      </p>
    );
  }

  const groups = Object.entries(SLOT_GROUP_BOUNDARIES)
    .map(([key, { label, start, end }]) => ({
      key,
      label,
      slots: slots.filter((time) => {
        const hour = parseInt(time.split(":")[0], 10);
        return hour >= start && hour < end;
      }),
    }))
    .filter((g) => g.slots.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">
            {group.label}
          </h4>
          <div className="flex flex-wrap gap-2">
            {group.slots.map((time) => (
              <SlotChip
                key={time}
                time={time}
                isSelected={selectedTime === time}
                onClick={() => onSelect(time)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
