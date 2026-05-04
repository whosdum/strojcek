"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface BarberOption {
  id: string;
  label: string;
}

interface BarberFilterProps {
  barbers: BarberOption[];
  selected?: string;
}

export function BarberFilter({ barbers, selected }: BarberFilterProps) {
  const router = useRouter();
  const params = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(params);
    // Reset paging when changing the filter — the cursor was bound to
    // the previous result set, so re-applying it would skip rows or
    // 404 against the new ordering.
    next.delete("cursor");
    if (e.target.value) {
      next.set("barberId", e.target.value);
    } else {
      next.delete("barberId");
    }
    const qs = next.toString();
    router.push(qs ? `/admin/reservations?${qs}` : "/admin/reservations");
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Barber:</span>
      <select
        value={selected ?? ""}
        onChange={handleChange}
        className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
      >
        <option value="">Všetci barberi</option>
        {barbers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
    </label>
  );
}
