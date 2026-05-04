"use client";

import { SLOT_GROUP_BOUNDARIES } from "@/lib/constants";
import { SlotChip } from "./slot-chip";
import { CalendarClockIcon } from "lucide-react";

interface TimeSlotsProps {
  slots: string[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
  onChangeDate?: () => void;
}

export function TimeSlots({ slots, selectedTime, onSelect, onChangeDate }: TimeSlotsProps) {
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <CalendarClockIcon className="size-8 text-muted-foreground/60" />
        <p className="text-[15px] text-muted-foreground">
          Na vybraný deň nie sú dostupné žiadne termíny.
        </p>
        {onChangeDate && (
          <button
            type="button"
            onClick={onChangeDate}
            className="mt-2 text-[14px] font-medium text-primary hover:underline"
          >
            Vybrať iný deň
          </button>
        )}
      </div>
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
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.key}>
          <h4 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h4>
          <div className="grid grid-cols-2 gap-2 min-[375px]:grid-cols-3 sm:flex sm:flex-wrap">
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
