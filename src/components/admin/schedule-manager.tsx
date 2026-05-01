"use client";

import { useState, useTransition } from "react";
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
import { Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
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

interface Barber {
  id: string;
  firstName: string;
  lastName: string;
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
}

interface ScheduleManagerProps {
  barbers: Barber[];
}

export function ScheduleManager({ barbers }: ScheduleManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedBarber, setSelectedBarber] = useState(barbers[0]?.id ?? "");
  const [breakToDelete, setBreakToDelete] = useState<string | null>(null);

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
        <Tabs defaultValue="schedule">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="schedule">Pracovné hodiny</TabsTrigger>
              <TabsTrigger value="breaks">Prestávky</TabsTrigger>
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
        </Tabs>
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
    </div>
  );
}

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
