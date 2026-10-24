"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SERVICE_DAYS,
  type ServiceAvailability,
} from "@/lib/service-availability";

type Mode = "all" | "custom" | "off";

interface ServiceAvailabilityFieldsProps {
  value: ServiceAvailability;
  onChange: (next: ServiceAvailability) => void;
  /** Per-day validation message (keyed "0".."6"). */
  errors?: Partial<Record<string, string>>;
}

function modeOf(value: ServiceAvailability, key: string): Mode {
  if (!(key in value)) return "all";
  return value[key] ? "custom" : "off";
}

/** Per-day online-booking window of a service. */
export function ServiceAvailabilityFields({
  value,
  onChange,
  errors,
}: ServiceAvailabilityFieldsProps) {
  const setDay = (key: string, mode: Mode) => {
    const next = { ...value };
    if (mode === "all") delete next[key];
    else if (mode === "off") next[key] = null;
    else next[key] = value[key] ?? { startTime: "07:00", endTime: "12:00" };
    onChange(next);
  };

  const setTime = (key: string, field: "startTime" | "endTime", time: string) => {
    const current = value[key];
    if (!current) return;
    onChange({ ...value, [key]: { ...current, [field]: time } });
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Dostupnosť online</legend>
      <p className="text-xs text-muted-foreground">
        Obmedzí, kedy si službu môžu zákazníci rezervovať online (napr. študentský
        strih len do 12:00). Služba musí skončiť do zadaného času. V admine môžete
        zapísať termín kedykoľvek.
      </p>
      <div className="space-y-2">
        {SERVICE_DAYS.map((day) => {
          const mode = modeOf(value, day.key);
          const w = value[day.key];
          return (
            <div key={day.key} className="space-y-1">
              {/* Mobile: day + select on one row, times wrap under the
                  select. sm+: day | select | times in one row. */}
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[6rem_11rem_minmax(0,1fr)]">
                <Label htmlFor={`avail-${day.key}`}>{day.long}</Label>
                <select
                  id={`avail-${day.key}`}
                  className="block w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
                  value={mode}
                  onChange={(e) => setDay(day.key, e.target.value as Mode)}
                >
                  <option value="all">Celý pracovný čas</option>
                  <option value="custom">Vlastný čas</option>
                  <option value="off">Nedostupná</option>
                </select>
                {mode === "custom" && w && (
                  <div className="col-start-2 flex min-w-0 items-center gap-2 sm:col-start-3">
                    <Input
                      type="time"
                      aria-label={`${day.long} od`}
                      value={w.startTime}
                      onChange={(e) => setTime(day.key, "startTime", e.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="time"
                      aria-label={`${day.long} do`}
                      value={w.endTime}
                      onChange={(e) => setTime(day.key, "endTime", e.target.value)}
                      className="min-w-0 flex-1"
                    />
                  </div>
                )}
              </div>
              {errors?.[day.key] && (
                <p className="text-xs text-destructive">{errors[day.key]}</p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
