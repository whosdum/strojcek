"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { sk } from "date-fns/locale/sk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  upsertSchedule,
  createBreak,
  deleteBreak,
} from "@/server/actions/schedules";
import {
  upsertOverride,
  deleteOverride,
} from "@/server/actions/overrides";
import { updateBarberBookingHorizon } from "@/server/actions/barbers";
import {
  CalendarOffIcon,
  ClockIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const DAYS = [
  "Nedeľa",
  "Pondelok",
  "Utorok",
  "Streda",
  "Štvrtok",
  "Piatok",
  "Sobota",
];

interface OverrideItem {
  id: string;
  barberId: string;
  overrideDate: Date;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

interface Barber {
  id: string;
  firstName: string;
  lastName: string;
  bookingHorizonWeeks: number;
  schedules: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }[];
  scheduleBreaks: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    label: string;
  }[];
  overrides: OverrideItem[];
}

interface ScheduleManagerProps {
  barbers: Barber[];
}

/** YYYY-MM-DD in Bratislava local time. Used as min for date inputs. */
function todayLocalKey(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Bratislava",
  });
}

/** today + 1 year in YYYY-MM-DD. Used as max for the override date picker. */
function maxOverrideDateKey(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function ScheduleManager({ barbers }: ScheduleManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedBarber, setSelectedBarber] = useState(barbers[0]?.id ?? "");
  const [breakToDelete, setBreakToDelete] = useState<string | null>(null);
  const [overrideToDelete, setOverrideToDelete] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [pendingConflict, setPendingConflict] = useState<{
    payload: OverridePayload;
    count: number;
    label: string;
    kind: "day_off" | "out_of_hours";
  } | null>(null);

  const barber = barbers.find((b) => b.id === selectedBarber);

  const handleSaveSchedule = (dayOfWeek: number, startTime: string, endTime: string, isActive: boolean) => {
    startTransition(async () => {
      try {
        await upsertSchedule({
          barberId: selectedBarber,
          dayOfWeek,
          startTime,
          endTime,
          isActive,
        });
        toast.success("Rozvrh bol uložený");
        router.refresh();
      } catch {
        toast.error("Nepodarilo sa uložiť rozvrh");
      }
    });
  };

  const handleDeleteBreak = (breakId: string) => {
    setBreakToDelete(breakId);
  };

  const confirmDeleteBreak = () => {
    if (!breakToDelete) return;
    const id = breakToDelete;
    setBreakToDelete(null);
    startTransition(async () => {
      try {
        const res = await deleteBreak(id);
        if (res.success) {
          toast.success("Prestávka bola zmazaná");
          router.refresh();
        } else {
          toast.error(res.error ?? "Nepodarilo sa zmazať prestávku");
        }
      } catch {
        toast.error("Nepodarilo sa zmazať prestávku");
      }
    });
  };

  const handleAddBreak = (dayOfWeek: number, startTime: string, endTime: string) => {
    startTransition(async () => {
      try {
        await createBreak({
          barberId: selectedBarber,
          dayOfWeek,
          startTime,
          endTime,
          label: "Prestávka",
        });
        toast.success("Rozvrh bol uložený");
        router.refresh();
      } catch {
        toast.error("Nepodarilo sa uložiť rozvrh");
      }
    });
  };

  const submitOverride = (payload: OverridePayload) => {
    startTransition(async () => {
      const res = await upsertOverride(payload);
      if (res.success) {
        toast.success(
          payload.isAvailable
            ? "Vlastné hodiny boli uložené"
            : "Voľný deň bol uložený"
        );
        router.refresh();
        return;
      }
      if (res.error === "conflict" && res.conflictCount && !payload.force) {
        setPendingConflict({
          payload,
          count: res.conflictCount,
          label: formatOverrideDateLabel(payload.overrideDate),
          kind: res.conflictKind ?? (payload.isAvailable ? "out_of_hours" : "day_off"),
        });
        return;
      }
      toast.error(res.error ?? "Nepodarilo sa uložiť výnimku");
    });
  };

  const confirmConflictOverride = () => {
    if (!pendingConflict) return;
    const next = { ...pendingConflict.payload, force: true };
    setPendingConflict(null);
    submitOverride(next);
  };

  const confirmDeleteOverride = () => {
    if (!overrideToDelete) return;
    const id = overrideToDelete.id;
    setOverrideToDelete(null);
    startTransition(async () => {
      const res = await deleteOverride(id);
      if (res.success) {
        toast.success("Výnimka bola zmazaná");
        router.refresh();
      } else {
        toast.error(res.error ?? "Nepodarilo sa zmazať výnimku");
      }
    });
  };

  return (
    <div>
      {barbers.length > 1 && (
        <div className="mb-4">
          <Label>Barber</Label>
          <select
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm sm:w-64"
            value={selectedBarber}
            onChange={(e) => setSelectedBarber(e.target.value)}
          >
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.firstName} {b.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      {barber && (
        <>
          <BookingHorizonCard
            // Re-mount when barber switches so the input picks up the new value.
            key={`horizon-${barber.id}`}
            barberId={barber.id}
            currentWeeks={barber.bookingHorizonWeeks}
          />

          <Tabs defaultValue="schedule">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="schedule">Pracovné hodiny</TabsTrigger>
                <TabsTrigger value="breaks">Prestávky</TabsTrigger>
                <TabsTrigger value="overrides">Výnimky</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="schedule" className="mt-4">
              <div className="space-y-3">
                {DAYS.map((dayName, dayOfWeek) => {
                  const schedule = barber.schedules.find(
                    (s) => s.dayOfWeek === dayOfWeek
                  );
                  return (
                    <DayScheduleRow
                      // Key includes barberId so switching barber forces a remount
                      // and the row picks up the new defaults instead of keeping
                      // the previous barber's times in local state.
                      key={`${selectedBarber}-${dayOfWeek}`}
                      dayName={dayName}
                      dayOfWeek={dayOfWeek}
                      startTime={schedule?.startTime ?? "09:00"}
                      endTime={schedule?.endTime ?? "17:00"}
                      isActive={schedule?.isActive ?? false}
                      isPending={isPending}
                      onSave={handleSaveSchedule}
                    />
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="breaks" className="mt-4">
              <div className="space-y-3">
                {DAYS.map((dayName, dayOfWeek) => {
                  const dayBreaks = barber.scheduleBreaks.filter(
                    (b) => b.dayOfWeek === dayOfWeek
                  );
                  return (
                    <Card key={dayOfWeek}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{dayName}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {dayBreaks.map((brk) => (
                          <div
                            key={brk.id}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <span>
                              {brk.startTime} — {brk.endTime}
                            </span>
                            <Badge variant="secondary">{brk.label}</Badge>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                handleDeleteBreak(`${selectedBarber}:${brk.id}`)
                              }
                              disabled={isPending}
                            >
                              <TrashIcon className="size-3" />
                            </Button>
                          </div>
                        ))}
                        <AddBreakRow
                          // Remount when barber changes or the number of breaks
                          // for that day changes, so inputs reset to defaults.
                          key={`${selectedBarber}-${dayOfWeek}-${dayBreaks.length}`}
                          dayOfWeek={dayOfWeek}
                          isPending={isPending}
                          onAdd={handleAddBreak}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="overrides" className="mt-4 space-y-4">
              <OverrideForm
                key={`override-form-${selectedBarber}`}
                barberId={selectedBarber}
                isPending={isPending}
                onSubmit={submitOverride}
              />
              <OverrideList
                overrides={barber.overrides}
                onDelete={(item) =>
                  setOverrideToDelete({
                    id: `${item.barberId}:${formatDateKey(item.overrideDate)}`,
                    label: formatOverrideDateLabel(formatDateKey(item.overrideDate)),
                  })
                }
                isPending={isPending}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <AlertDialog open={!!breakToDelete} onOpenChange={(open) => !open && setBreakToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať prestávku?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete zmazať túto prestávku? Táto akcia sa nedá vrátiť späť.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteBreak}>
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!overrideToDelete}
        onOpenChange={(open) => !open && setOverrideToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať výnimku?</AlertDialogTitle>
            <AlertDialogDescription>
              Výnimka pre {overrideToDelete?.label} bude odstránená a v daný
              deň sa znovu uplatní bežný rozvrh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteOverride}
            >
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingConflict}
        onOpenChange={(open) => !open && setPendingConflict(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConflict?.kind === "out_of_hours"
                ? "Niektoré rezervácie sú mimo nových hodín"
                : "Na tento deň existujú aktívne rezervácie"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConflict?.kind === "out_of_hours" ? (
                <>
                  Dátum {pendingConflict?.label}: {pendingConflict?.count}{" "}
                  {plural(
                    pendingConflict?.count ?? 0,
                    "aktívna rezervácia je",
                    "aktívne rezervácie sú",
                    "aktívnych rezervácií je"
                  )}{" "}
                  mimo nových pracovných hodín
                  {pendingConflict?.payload.startTime && pendingConflict?.payload.endTime
                    ? ` (${pendingConflict.payload.startTime}–${pendingConflict.payload.endTime})`
                    : ""}
                  . Po uložení výnimky sa nezrušia automaticky — zákazníci
                  ich uvidia v potvrdzujúcom emaile, ale verejný kalendár ich
                  nezohľadní. Buď zúžte hodiny tak, aby pokryli existujúce
                  termíny, alebo manuálne kontaktujte zákazníkov.
                </>
              ) : (
                <>
                  Dátum {pendingConflict?.label} má {pendingConflict?.count}{" "}
                  {plural(
                    pendingConflict?.count ?? 0,
                    "aktívnu rezerváciu",
                    "aktívne rezervácie",
                    "aktívnych rezervácií"
                  )}
                  . Označením ako voľný deň sa rezervácie nezrušia automaticky
                  — ostanú v systéme a musíte zákazníkov kontaktovať manuálne.
                  Naozaj pokračovať?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmConflictOverride}
            >
              {pendingConflict?.kind === "out_of_hours"
                ? "Aj tak uložiť vlastné hodiny"
                : "Aj tak označiť ako voľný deň"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Booking horizon quick-edit
// ---------------------------------------------------------------------------

function BookingHorizonCard({
  barberId,
  currentWeeks,
}: {
  barberId: string;
  currentWeeks: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentWeeks));
  const [isPending, startTransition] = useTransition();

  const parsed = parseInt(value, 10);
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 26;
  const isDirty = isValid && parsed !== currentWeeks;

  const handleSave = () => {
    if (!isDirty) return;
    startTransition(async () => {
      const res = await updateBarberBookingHorizon(barberId, parsed);
      if (res.success) {
        toast.success("Horizont rezervácií bol aktualizovaný");
        router.refresh();
      } else {
        toast.error(res.error ?? "Nastala chyba");
      }
    });
  };

  // Show the user the actually-saved horizon, not the in-edit value, so the
  // sentence remains a fact about current state. Slovak plural agreement:
  // 1 = "týždeň", 2-4 = "týždne", 5+ = "týždňov".
  const weeksWord = (() => {
    if (currentWeeks === 1) return "týždeň";
    if (currentWeeks >= 2 && currentWeeks <= 4) return "týždne";
    return "týždňov";
  })();

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Horizont rezervácií</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Zákazníci môžu rezervovať najviac{" "}
          <strong className="text-foreground">
            {currentWeeks} {weeksWord}
          </strong>{" "}
          dopredu.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            max={26}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24"
            aria-label="Horizont v týždňoch"
          />
          <span className="text-sm text-muted-foreground">
            týždňov (1 – 26)
          </span>
          {isDirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || !isValid}
            >
              {isPending ? "Ukladám..." : "Uložiť"}
            </Button>
          )}
        </div>
        {!isValid && value !== "" && (
          <p className="mt-2 text-xs text-destructive">
            Hodnota musí byť celé číslo medzi 1 a 26.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Day schedule + breaks (existing)
// ---------------------------------------------------------------------------

function DayScheduleRow({
  dayName,
  dayOfWeek,
  startTime: defaultStart,
  endTime: defaultEnd,
  isActive: defaultActive,
  isPending,
  onSave,
}: {
  dayName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  isPending: boolean;
  onSave: (dayOfWeek: number, startTime: string, endTime: string, isActive: boolean) => void;
}) {
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [isActive, setIsActive] = useState(defaultActive);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{dayName}</div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{isActive ? "Aktívny" : "Neaktívny"}</span>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full sm:w-28"
            disabled={!isActive}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full sm:w-28"
            disabled={!isActive}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => onSave(dayOfWeek, startTime, endTime, isActive)}
          className="min-h-[44px] w-full sm:min-h-0 sm:w-auto"
        >
          {isPending ? <Loader2Icon className="size-3 animate-spin" /> : "Uložiť"}
        </Button>
      </div>
    </div>
  );
}

function AddBreakRow({
  dayOfWeek,
  isPending,
  onAdd,
}: {
  dayOfWeek: number;
  isPending: boolean;
  onAdd: (dayOfWeek: number, startTime: string, endTime: string) => void;
}) {
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("12:30");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <Input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full sm:w-28"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-full sm:w-28"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => onAdd(dayOfWeek, startTime, endTime)}
        className="min-h-[44px] w-full sm:min-h-0 sm:w-auto"
      >
        <PlusIcon className="mr-1 size-3" />
        Pridať
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overrides — form + list
// ---------------------------------------------------------------------------

type OverridePayload = {
  barberId: string;
  overrideDate: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string;
  force?: boolean;
};

function OverrideForm({
  barberId,
  isPending,
  onSubmit,
}: {
  barberId: string;
  isPending: boolean;
  onSubmit: (p: OverridePayload) => void;
}) {
  const minDate = useMemo(() => todayLocalKey(), []);
  const maxDate = useMemo(() => maxOverrideDateKey(), []);
  const [date, setDate] = useState("");
  const [type, setType] = useState<"off" | "custom">("off");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!date) {
      setError("Zadajte dátum.");
      return;
    }
    if (date < minDate) {
      setError("Dátum nesmie byť v minulosti.");
      return;
    }
    if (type === "custom") {
      if (!startTime || !endTime) {
        setError("Zadajte začiatok aj koniec pracovných hodín.");
        return;
      }
      if (startTime >= endTime) {
        setError("Koniec musí byť po začiatku.");
        return;
      }
    }
    onSubmit({
      barberId,
      overrideDate: date,
      isAvailable: type === "custom",
      startTime: type === "custom" ? startTime : null,
      endTime: type === "custom" ? endTime : null,
      reason: reason.trim(),
    });
    // Reset on success path; even on conflict the dialog re-confirms with same data.
    setDate("");
    setReason("");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pridať výnimku</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="override-date">Dátum</Label>
          <Input
            id="override-date"
            type="date"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-56"
          />
        </div>

        <div className="space-y-2">
          <Label>Typ</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="override-type"
                value="off"
                checked={type === "off"}
                onChange={() => setType("off")}
              />
              <CalendarOffIcon className="size-4 text-muted-foreground" />
              Voľný deň
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="override-type"
                value="custom"
                checked={type === "custom"}
                onChange={() => setType("custom")}
              />
              <ClockIcon className="size-4 text-muted-foreground" />
              Vlastné pracovné hodiny
            </label>
          </div>
        </div>

        {type === "custom" && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Label className="text-sm sm:w-12">Od</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full sm:w-32"
              />
              <Label className="text-sm sm:w-12">Do</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full sm:w-32"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Bežné prestávky v tento deň <strong>neplatia</strong> — výnimka
              celkom prepíše rozvrh.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="override-reason">Dôvod (voliteľné)</Label>
          <Input
            id="override-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="napr. Lekár, dovolenka, sviatok"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={submit}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <PlusIcon className="mr-1 size-4" />
          )}
          Pridať výnimku
        </Button>
      </CardContent>
    </Card>
  );
}

function OverrideList({
  overrides,
  onDelete,
  isPending,
}: {
  overrides: OverrideItem[];
  onDelete: (item: OverrideItem) => void;
  isPending: boolean;
}) {
  if (overrides.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nadchádzajúce výnimky</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Zatiaľ žiadne nadchádzajúce výnimky.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by month label for readability.
  const groups = new Map<string, OverrideItem[]>();
  for (const o of overrides) {
    const key = format(o.overrideDate, "LLLL yyyy", { locale: sk });
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Nadchádzajúce výnimky</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[...groups.entries()].map(([month, items]) => (
          <div key={month} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {capitalize(month)}
            </p>
            <ul className="divide-y divide-border/40 rounded-lg border">
              {items.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="w-28 shrink-0 font-medium tabular-nums">
                    {format(o.overrideDate, "EEE d.M.", { locale: sk })}
                  </span>
                  {o.isAvailable ? (
                    <Badge variant="secondary" className="gap-1">
                      <ClockIcon className="size-3" />
                      {o.startTime} – {o.endTime}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <CalendarOffIcon className="size-3" />
                      Voľný deň
                    </Badge>
                  )}
                  {o.reason && (
                    <span className="text-muted-foreground">
                      &bdquo;{o.reason}&ldquo;
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ml-auto"
                    onClick={() => onDelete(o)}
                    disabled={isPending}
                    aria-label="Zmazať výnimku"
                  >
                    <TrashIcon className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateKey(d: Date): string {
  // Local YYYY-MM-DD (overrideDate from server is already noon-local Date).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatOverrideDateLabel(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEEE d. MMMM yyyy", { locale: sk });
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Slovak plural — singular / 2-4 / 5+. */
function plural(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
