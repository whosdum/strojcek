"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlotChip } from "@/components/booking/slot-chip";

import { fetchSlots } from "@/server/actions/slots";
import {
  createAppointmentAdmin,
  updateAppointment,
} from "@/server/actions/appointments";
import {
  SLOT_GROUP_BOUNDARIES,
  STATUS_LABELS,
  TIMEZONE,
} from "@/lib/constants";
import type { AppointmentStatus } from "@/lib/types";

interface BarberOption {
  id: string;
  firstName: string;
  lastName: string;
  serviceIds: string[];
}

interface ServiceOption {
  id: string;
  name: string;
}

interface AppointmentInitial {
  id: string;
  barberId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD in Bratislava
  time: string; // HH:mm in Bratislava
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  priceFinal: number | null;
  status: AppointmentStatus;
}

interface AppointmentFormProps {
  mode: "create" | "edit";
  services: ServiceOption[];
  barbers: BarberOption[];
  initial?: AppointmentInitial;
}

interface FormState {
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  phonePrefix: "+421" | "+420";
  phoneDigits: string;
  email: string;
  notes: string;
  ignoreSchedule: boolean;
  priceFinal: string;
}

function todayIso() {
  const now = toZonedTime(new Date(), TIMEZONE);
  return format(now, "yyyy-MM-dd");
}

function splitPhone(phone: string): { prefix: "+421" | "+420"; digits: string } {
  if (phone.startsWith("+420")) {
    return { prefix: "+420", digits: phone.slice(4) };
  }
  if (phone.startsWith("+421")) {
    return { prefix: "+421", digits: phone.slice(4) };
  }
  return { prefix: "+421", digits: "" };
}

export function AppointmentForm({
  mode,
  services,
  barbers,
  initial,
}: AppointmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slotData, setSlotData] = useState<{ key: string; slots: string[] } | null>(null);

  const limited = !!initial && (initial.status === "IN_PROGRESS" || initial.status === "COMPLETED");

  const [form, setForm] = useState<FormState>(() => {
    const phoneSplit = initial?.phone ? splitPhone(initial.phone) : { prefix: "+421" as const, digits: "" };
    return {
      serviceId: initial?.serviceId ?? services[0]?.id ?? "",
      barberId: initial?.barberId ?? "",
      date: initial?.date ?? todayIso(),
      time: initial?.time ?? "",
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      phonePrefix: phoneSplit.prefix,
      phoneDigits: phoneSplit.digits,
      email: initial?.email ?? "",
      notes: initial?.notes ?? "",
      ignoreSchedule: false,
      priceFinal: initial?.priceFinal != null ? String(initial.priceFinal) : "",
    };
  });

  // Filter barbers offering the selected service
  const eligibleBarbers = useMemo(
    () =>
      form.serviceId
        ? barbers.filter((b) => b.serviceIds.includes(form.serviceId))
        : barbers,
    [barbers, form.serviceId]
  );

  const serviceItems = useMemo(
    () => Object.fromEntries(services.map((s) => [s.id, s.name])),
    [services]
  );

  const barberItems = useMemo(
    () =>
      Object.fromEntries(
        eligibleBarbers.map((b) => [b.id, `${b.firstName} ${b.lastName}`])
      ),
    [eligibleBarbers]
  );

  // Visible barberId — auto-falls back to "" when current barber doesn't offer
  // the selected service. Storing this as derived state avoids mutating form
  // inside a useEffect.
  const effectiveBarberId =
    form.barberId && eligibleBarbers.some((b) => b.id === form.barberId)
      ? form.barberId
      : "";

  // Build a "fetch key" — null means we don't fetch (override or missing inputs)
  const fetchKey =
    form.ignoreSchedule || !effectiveBarberId || !form.serviceId || !form.date
      ? null
      : `${effectiveBarberId}|${form.serviceId}|${form.date}`;

  // Fetch slots when key changes. State updates happen only in async callbacks
  // (after the fetch resolves), not synchronously inside the effect body.
  useEffect(() => {
    if (!fetchKey) return;
    let cancelled = false;
    fetchSlots(effectiveBarberId, form.serviceId, form.date, initial?.id)
      .then((res) => {
        if (!cancelled) setSlotData({ key: fetchKey, slots: res });
      })
      .catch(() => {
        if (!cancelled) setSlotData({ key: fetchKey, slots: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, effectiveBarberId, form.serviceId, form.date, initial?.id]);

  const slotsLoading = fetchKey !== null && slotData?.key !== fetchKey;
  const slots = fetchKey !== null && slotData?.key === fetchKey ? slotData.slots : null;

  const groupedSlots = useMemo(() => {
    if (!slots) return [];
    return Object.entries(SLOT_GROUP_BOUNDARIES)
      .map(([key, { label, start, end }]) => ({
        key,
        label,
        slots: slots.filter((time) => {
          const hour = parseInt(time.split(":")[0], 10);
          return hour >= start && hour < end;
        }),
      }))
      .filter((g) => g.slots.length > 0);
  }, [slots]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!limited) {
      if (!form.serviceId) {
        setError("Vyberte službu.");
        return;
      }
      if (!effectiveBarberId) {
        setError("Vyberte barbera.");
        return;
      }
      if (!form.date || !form.time) {
        setError("Vyberte dátum a čas.");
        return;
      }
      if (!form.firstName.trim()) {
        setError("Zadajte meno zákazníka.");
        return;
      }
      if (!/^[1-9]\d{8}$/.test(form.phoneDigits)) {
        setError("Zadajte 9-miestne telefónne číslo bez úvodnej nuly (napr. 903123456).");
        return;
      }
      // Email is required for create (so customer gets confirmation + reminder).
      // For edit it stays optional — legacy reservations may not have one.
      if (mode === "create" && !form.email.trim()) {
        setError("Email je povinný — zákazník dostane potvrdenie a pripomienku.");
        return;
      }
    }

    startTransition(async () => {
      const fullPhone = `${form.phonePrefix}${form.phoneDigits}`;
      const payload = {
        serviceId: form.serviceId,
        barberId: effectiveBarberId,
        date: form.date,
        time: form.time,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: fullPhone,
        email: form.email.trim(),
        notes: form.notes.trim(),
        ignoreSchedule: form.ignoreSchedule,
      };

      let result: { success: boolean; error?: string; appointmentId?: string };
      if (mode === "create") {
        result = await createAppointmentAdmin(payload);
      } else if (initial) {
        result = await updateAppointment(initial.id, {
          ...payload,
          priceFinal:
            form.priceFinal.trim() === "" ? null : Number(form.priceFinal),
        });
      } else {
        return;
      }

      if (result.success) {
        toast.success(mode === "create" ? "Rezervácia vytvorená" : "Rezervácia uložená");
        const targetId = result.appointmentId ?? initial?.id;
        if (targetId) {
          router.push(`/admin/reservations/${targetId}`);
        } else {
          router.push("/admin/reservations");
        }
        router.refresh();
      } else {
        setError(result.error ?? "Nastala chyba.");
        toast.error(result.error ?? "Nepodarilo sa uložiť rezerváciu");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {limited && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Termín už prebieha alebo je dokončený ({STATUS_LABELS[initial!.status]}).
          Možno upraviť len finálnu cenu a poznámku.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Služba a barber */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="serviceId">Služba *</Label>
          <Select
            items={serviceItems}
            value={form.serviceId}
            onValueChange={(v) => updateField("serviceId", v ?? "")}
            disabled={limited}
          >
            <SelectTrigger id="serviceId" className="w-full">
              <SelectValue placeholder="Vyberte službu" />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="barberId">Barber *</Label>
          <Select
            items={barberItems}
            value={effectiveBarberId}
            onValueChange={(v) => updateField("barberId", v ?? "")}
            disabled={limited || !form.serviceId}
          >
            <SelectTrigger id="barberId" className="w-full">
              <SelectValue
                placeholder={
                  form.serviceId ? "Vyberte barbera" : "Najprv vyberte službu"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {eligibleBarbers.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Žiadny barber neponúka túto službu.
                </div>
              ) : (
                eligibleBarbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.firstName} {b.lastName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dátum a čas */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Dátum *</Label>
          <Input
            id="date"
            type="date"
            value={form.date}
            min={form.ignoreSchedule ? undefined : todayIso()}
            onChange={(e) => updateField("date", e.target.value)}
            disabled={limited}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="time">Čas *</Label>
            {form.time && !form.ignoreSchedule && (
              <span className="text-xs text-muted-foreground tabular-nums">
                Vybrané: {form.time}
              </span>
            )}
          </div>

          {form.ignoreSchedule ? (
            <Input
              id="time"
              type="time"
              value={form.time}
              onChange={(e) => updateField("time", e.target.value)}
              disabled={limited}
            />
          ) : !effectiveBarberId || !form.serviceId || !form.date ? (
            <p className="text-sm text-muted-foreground">
              Vyberte službu, barbera a dátum aby sa zobrazili dostupné termíny.
            </p>
          ) : slotsLoading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Načítavam dostupné termíny…
            </div>
          ) : groupedSlots.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              Na vybraný deň nie sú voľné termíny. Vyberte iný dátum alebo zapnite
              „Ignorovať rozvrh“.
            </p>
          ) : (
            <div className="space-y-3">
              {groupedSlots.map((group) => (
                <div key={group.key}>
                  <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </h4>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {group.slots.map((time) => (
                      <SlotChip
                        key={time}
                        time={time}
                        isSelected={form.time === time}
                        onClick={() => updateField("time", time)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
          <Switch
            id="ignoreSchedule"
            checked={form.ignoreSchedule}
            onCheckedChange={(v) => {
              updateField("ignoreSchedule", v);
              // When toggling on, clear time so admin types a new one explicitly
              if (v) updateField("time", "");
            }}
            disabled={limited}
          />
          <div className="flex-1">
            <Label htmlFor="ignoreSchedule" className="cursor-pointer">
              Ignorovať rozvrh a prekryv
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Použite pre walk-in alebo neštandardný termín — preskočí kontrolu
              pracovného času, prestávok a kolízií.
            </p>
          </div>
        </div>
      </div>

      {/* Zákazník */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Zákazník</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Meno *</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              disabled={limited}
              autoComplete="given-name"
              maxLength={50}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Priezvisko</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              disabled={limited}
              autoComplete="family-name"
              maxLength={50}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phoneDigits">Telefón *</Label>
          <div className="flex gap-2">
            <Select
              items={{ "+421": "+421 SK", "+420": "+420 CZ" }}
              value={form.phonePrefix}
              onValueChange={(v) =>
                updateField("phonePrefix", (v ?? "+421") as "+421" | "+420")
              }
              disabled={limited}
            >
              <SelectTrigger className="w-[112px] shrink-0">
                <SelectValue placeholder="+421" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+421">+421 SK</SelectItem>
                <SelectItem value="+420">+420 CZ</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="phoneDigits"
              type="tel"
              inputMode="numeric"
              maxLength={9}
              placeholder="9XX XXX XXX"
              value={form.phoneDigits}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                // Strip leading zero — prefix is selected separately
                const cleaned = digits.startsWith("0") ? digits.slice(1) : digits;
                updateField("phoneDigits", cleaned);
              }}
              disabled={limited}
              autoComplete="tel-national"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            9-miestne číslo bez úvodnej nuly (napr. 903123456). Telefón
            identifikuje zákazníka — existujúci sa automaticky priradí.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email {mode === "create" && "*"}</Label>
          <Input
            id="email"
            type="email"
            placeholder={mode === "create" ? "klient@email.sk" : "voliteľný"}
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            disabled={limited}
            autoComplete="email"
            maxLength={254}
          />
          <p className="text-xs text-muted-foreground">
            {mode === "create"
              ? "Klient dostane potvrdzujúci email a pripomienku deň pred termínom."
              : "Email môže byť prázdny pri starších rezerváciách bez emailu."}
          </p>
        </div>
      </div>

      {/* Cena a poznámka */}
      {mode === "edit" && (
        <div className="space-y-1.5">
          <Label htmlFor="priceFinal">Finálna cena (€)</Label>
          <Input
            id="priceFinal"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="napr. 15.00"
            value={form.priceFinal}
            onChange={(e) => updateField("priceFinal", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Suma ktorú zákazník skutočne zaplatil. Nechajte prázdne ak ešte nie je
            známa.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Poznámka</Label>
        <Textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={mode === "edit" && initial ? `/admin/reservations/${initial.id}` : "/admin/reservations"}>
          <Button type="button" variant="outline" className="w-full sm:w-auto">
            Zrušiť
          </Button>
        </Link>
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {mode === "create" ? "Vytvoriť rezerváciu" : "Uložiť zmeny"}
        </Button>
      </div>
    </form>
  );
}
