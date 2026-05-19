"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { sk } from "date-fns/locale/sk";
import { toZonedTime } from "date-fns-tz";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
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
import { SlotChip } from "@/components/booking/slot-chip";

import { fetchSlots } from "@/server/actions/slots";
import {
  createAppointmentAdmin,
  fetchDayAppointments,
  updateAppointment,
  type DayAppointmentSummary,
} from "@/server/actions/appointments";
import {
  SLOT_GROUP_BOUNDARIES,
  STATUS_LABELS,
  TIMEZONE,
} from "@/lib/constants";
import type { AppointmentSource, AppointmentStatus } from "@/lib/types";

interface BarberOption {
  id: string;
  firstName: string;
  lastName: string;
  serviceIds: string[];
}

interface ServiceOption {
  id: string;
  name: string;
  /** Used to draw a "draft" ghost entry in the day-overview panel — admin
   *  sees where the new reservation would land before submitting. */
  durationMinutes: number;
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
  source: AppointmentSource;
  /** Used as the label seed when source === "walk-in" — the appointment
   *  has no customer doc, so the customerName field IS the label. */
  customerName: string | null;
  /** Walk-in only: existing duration in minutes (endTime − startTime).
   *  Lets the form prefill the override field on edit. */
  durationMinutes: number | null;
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
  walkIn: boolean;
  label: string;
  /** Walk-in only: minutes the block should occupy. Empty string falls
   *  back to the selected service's default duration on the server. */
  customDurationMinutes: string;
}

interface WalkInTemplate {
  id: string;
  label: string;
  /** Empty string = "let the service decide" (admin still enters
   *  duration manually if needed). */
  durationMinutes: string;
  /** When true, also flips the ignoreSchedule switch on click — the
   *  slot picker doesn't know about custom durations, and these
   *  templates are typically used for free-time blocks anyway. */
  forceIgnoreSchedule: boolean;
}

const WALK_IN_TEMPLATES: WalkInTemplate[] = [
  { id: "out", label: "Mimo prevádzky", durationMinutes: "60", forceIgnoreSchedule: true },
  { id: "lunch", label: "Obed", durationMinutes: "30", forceIgnoreSchedule: true },
  { id: "break", label: "Krátka pauza", durationMinutes: "15", forceIgnoreSchedule: true },
];

function todayIso() {
  const now = toZonedTime(new Date(), TIMEZONE);
  return format(now, "yyyy-MM-dd");
}

// Force the browser-native date/time popup to open. Safari (and older Chrome
// on some platforms) doesn't open the picker when the user clicks the field
// background — only when they hit the tiny chevron. Calling showPicker()
// from a user gesture restores the expected click-anywhere behavior.
function openNativePicker(e: React.SyntheticEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  if (typeof el.showPicker !== "function") return;
  try {
    el.showPicker();
  } catch {
    // showPicker throws if the input is hidden, disabled, or the gesture
    // requirement is not met. Silent fail — user can still type the value.
  }
}

/** "75 min" → "1h 15min"; "60" → "1h"; "45" → "45min". Used as a
 *  human-readable companion to the raw-minute trvanie in the confirm
 *  dialog so the admin doesn't have to do mental math. */
function formatDurationHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
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
  const [dayData, setDayData] = useState<{
    key: string;
    appointments: DayAppointmentSummary[];
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Mobile-only collapsible state for the day panel. Default collapsed
  // to save vertical space. When a new conflict appears we auto-open
  // once (so the warning isn't tucked away) but a subsequent user
  // collapse is respected — see the useEffect below.
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const prevDayConflictsRef = useRef(false);

  const limited = !!initial && (initial.status === "IN_PROGRESS" || initial.status === "COMPLETED");

  const initialIsWalkIn = initial?.source === "walk-in";

  const [form, setForm] = useState<FormState>(() => {
    const phoneSplit = initial?.phone ? splitPhone(initial.phone) : { prefix: "+421" as const, digits: "" };
    // Walk-ins are typically created with ignoreSchedule on (custom time
    // outside the slot grid, custom duration). Re-opening one for edit
    // should keep that mode active — otherwise the time input gets
    // replaced by the slot picker, which doesn't show the saved off-grid
    // time and silently drops it on save.
    const editingWalkIn = mode === "edit" && initialIsWalkIn;
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
      ignoreSchedule: editingWalkIn,
      priceFinal: initial?.priceFinal != null ? String(initial.priceFinal) : "",
      walkIn: initialIsWalkIn || mode === "create",
      label: initialIsWalkIn ? initial?.customerName?.trim() || "Walk-in" : "",
      customDurationMinutes:
        initialIsWalkIn && initial?.durationMinutes
          ? String(initial.durationMinutes)
          : "",
    };
  });

  const applyWalkInTemplate = (tpl: WalkInTemplate) => {
    setForm((s) => ({
      ...s,
      walkIn: true,
      label: tpl.label,
      customDurationMinutes: tpl.durationMinutes,
      ignoreSchedule: tpl.forceIgnoreSchedule || s.ignoreSchedule,
      // Clear the time when forcing schedule-ignore so admin types a
      // fresh start time instead of keeping a stale slot pick.
      time: tpl.forceIgnoreSchedule ? "" : s.time,
    }));
  };

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

  // Visible barberId — auto-falls back to first eligible in create mode so
  // the field doesn't go blank when service changes. Edit mode keeps strict
  // matching so we don't silently swap the barber on a saved appointment.
  const effectiveBarberId =
    form.barberId && eligibleBarbers.some((b) => b.id === form.barberId)
      ? form.barberId
      : mode === "create"
        ? eligibleBarbers[0]?.id ?? ""
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

  // Day panel data — fetched independently of slot availability so the
  // admin sees the day's existing reservations even when ignoreSchedule is
  // on (which is the typical walk-in scenario).
  const dayKey =
    effectiveBarberId && form.date
      ? `${effectiveBarberId}|${form.date}`
      : null;

  useEffect(() => {
    if (!dayKey) return;
    let cancelled = false;
    fetchDayAppointments(effectiveBarberId, form.date, initial?.id)
      .then((res) => {
        if (!cancelled) setDayData({ key: dayKey, appointments: res });
      })
      .catch(() => {
        if (!cancelled) setDayData({ key: dayKey, appointments: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey, effectiveBarberId, form.date, initial?.id]);

  const dayLoading = dayKey !== null && dayData?.key !== dayKey;
  const dayAppointments =
    dayKey !== null && dayData?.key === dayKey ? dayData.appointments : null;

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

  /** Pretty Slovak "pondelok, 11. mája 2026" for the dialog + day panel. */
  const formattedDate = useMemo(() => {
    if (!form.date) return "";
    try {
      return format(parseISO(form.date), "EEEE d. MMMM yyyy", { locale: sk });
    } catch {
      return form.date;
    }
  }, [form.date]);

  const summaryService = services.find((s) => s.id === form.serviceId)?.name ?? "—";
  const summaryBarber = (() => {
    const b = barbers.find((x) => x.id === effectiveBarberId);
    return b ? `${b.firstName} ${b.lastName}` : "—";
  })();
  const summaryWho = form.walkIn
    ? form.label.trim() || "Walk-in"
    : `${form.firstName.trim()} ${form.lastName.trim()}`.trim() || "—";

  /** Ghost row for the day panel — visualises where the in-progress
   *  reservation would land. Null when there's not enough info yet
   *  (missing time or unknown duration). Wraps over midnight via mod-24
   *  so a 22:00 + 4h still shows a sensible 02:00 end. */
  const draftEntry = useMemo<{
    startTime: string;
    endTime: string;
    title: string;
  } | null>(() => {
    if (!form.time || !/^\d{1,2}:\d{2}$/.test(form.time)) return null;
    const customDur =
      form.walkIn && form.customDurationMinutes.trim() !== ""
        ? Number(form.customDurationMinutes)
        : null;
    const serviceDur = services.find((s) => s.id === form.serviceId)?.durationMinutes ?? null;
    const dur = customDur && customDur > 0 ? customDur : serviceDur;
    if (!dur || dur < 1) return null;
    const [h, m] = form.time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const totalMin = h * 60 + m + dur;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    const startTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const title = form.walkIn
      ? form.label.trim() || "Walk-in"
      : `${form.firstName.trim()} ${form.lastName.trim()}`.trim() || "Nový zákazník";
    return { startTime, endTime, title };
  }, [
    form.time,
    form.walkIn,
    form.customDurationMinutes,
    form.serviceId,
    form.firstName,
    form.lastName,
    form.label,
    services,
  ]);

  /** Merged list of real bookings + the in-progress draft, sorted by
   *  start time. Each row carries flags so the panel can highlight
   *  conflicts (draft overlapping an existing booking) in red. */
  type DayPanelRow =
    | (DayAppointmentSummary & { isDraft?: false; isConflict?: boolean })
    | {
        id: "__draft__";
        startTime: string;
        endTime: string;
        title: string;
        isDraft: true;
        hasConflicts: boolean;
      };
  const combinedDay = useMemo<DayPanelRow[] | null>(() => {
    if (!dayAppointments) return null;

    // Convert "HH:mm" → minutes; wrap end past midnight so a 22:00 + 4h
    // draft is still compared correctly against a 23:00 booking.
    const toMin = (s: string) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m;
    };
    let draftStart = -1;
    let draftEnd = -1;
    if (draftEntry) {
      draftStart = toMin(draftEntry.startTime);
      draftEnd = toMin(draftEntry.endTime);
      if (draftEnd <= draftStart) draftEnd += 24 * 60;
    }

    const list: DayPanelRow[] = dayAppointments.map((a) => {
      if (!draftEntry) return a;
      const aStart = toMin(a.startTime);
      let aEnd = toMin(a.endTime);
      if (aEnd <= aStart) aEnd += 24 * 60;
      // Standard half-open interval overlap: [aStart, aEnd) ∩ [draftStart, draftEnd).
      // Touching edges (15:00–16:00 vs 16:00–17:00) is NOT a conflict.
      const isConflict = aStart < draftEnd && draftStart < aEnd;
      return { ...a, isConflict };
    });

    if (draftEntry) {
      const hasConflicts = list.some(
        (x) => !x.isDraft && x.isConflict === true,
      );
      list.push({ id: "__draft__", ...draftEntry, isDraft: true, hasConflicts });
    }
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return list;
  }, [dayAppointments, draftEntry]);

  /** True when the draft overlaps any existing booking. Surfaced as a
   *  banner above the timeline so the admin doesn't have to spot it from
   *  the colored blocks alone. */
  const draftHasConflicts =
    combinedDay?.some(
      (row): row is DayPanelRow & { isDraft: true; hasConflicts: true } =>
        row.isDraft === true && row.hasConflicts === true,
    ) ?? false;

  // Auto-open the mobile day panel the moment a new conflict appears —
  // a force-open via `isOpen = open || conflicts` was the previous
  // attempt but it locked the user out of collapsing while the conflict
  // existed. With a ref we only push open on the false→true transition,
  // so a manual collapse afterwards sticks.
  useEffect(() => {
    if (draftHasConflicts && !prevDayConflictsRef.current) {
      setDayPanelOpen(true);
    }
    prevDayConflictsRef.current = draftHasConflicts;
  }, [draftHasConflicts]);

  /** Geometric layout for the day-overview timeline. Each row is placed
   *  in a "lane" — the first one where it doesn't overlap a previously
   *  placed item — so two reservations starting at the same time render
   *  side-by-side instead of stacked. Heights and y-positions are in
   *  pixels (PX_PER_MIN px per minute) relative to the visible window. */
  const timelineLayout = useMemo(() => {
    if (!combinedDay || combinedDay.length === 0) return null;

    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };

    const items = combinedDay.map((row) => {
      const startMin = toMinutes(row.startTime);
      let endMin = toMinutes(row.endTime);
      if (endMin <= startMin) endMin += 24 * 60;
      return { ...row, startMin, endMin };
    });

    const minStart = Math.min(...items.map((i) => i.startMin));
    const maxEnd = Math.max(...items.map((i) => i.endMin));
    const windowStart = Math.floor(minStart / 60) * 60;
    const windowEnd = Math.ceil(maxEnd / 60) * 60;

    // Sweep-line lane assignment: scan by start time, place into the
    // first lane whose last booking ends ≤ this start. Greedy but
    // optimal for the side-by-side-when-overlapping visual we want.
    const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
    const laneEnds: number[] = [];
    const placed = sorted.map((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.endMin);
      } else {
        laneEnds[lane] = it.endMin;
      }
      return { ...it, lane };
    });

    // Width/left percentages — each item is sized to the max lane count
    // among items overlapping it, not the global max, so a lone booking
    // in a quiet hour still takes full width.
    const positioned = placed.map((it) => {
      const concurrent = placed.filter(
        (o) => o.startMin < it.endMin && it.startMin < o.endMin,
      );
      const totalLanes = Math.max(...concurrent.map((o) => o.lane)) + 1;
      return {
        ...it,
        widthPct: 100 / totalLanes,
        leftPct: (it.lane / totalLanes) * 100,
      };
    });

    const hours: number[] = [];
    for (let m = windowStart; m <= windowEnd; m += 60) hours.push(m);

    return {
      items: positioned,
      hours,
      windowStart,
      totalMin: windowEnd - windowStart,
    };
  }, [combinedDay]);

  // Slovak plural for "rezervácie" — 1: rezervácia, 2-4: rezervácie,
  // else: rezervácií. Used in the panel header so the collapsed mobile
  // state still tells the admin "how many" at a glance.
  const pluralRezervacii = (n: number): string => {
    if (n === 1) return "rezervácia";
    if (n >= 2 && n <= 4) return "rezervácie";
    return "rezervácií";
  };
  const dayBookingCount = dayAppointments?.length ?? 0;

  /** Header bit shown both in the desktop sidebar (static) and as a
   *  mobile toggle button label. Adds a booking-count line so the
   *  collapsed mobile state still gives a quick "how busy" cue. */
  const dayPanelHeader = (
    <div className="min-w-0 text-left">
      <h3 className="text-sm font-semibold text-foreground">Tento deň</h3>
      <p className="truncate text-xs text-muted-foreground">
        {formattedDate || "Vyberte dátum"}
        {summaryBarber !== "—" ? ` · ${summaryBarber}` : ""}
      </p>
      {effectiveBarberId && form.date && dayAppointments && (
        <p
          className={`text-xs ${
            draftHasConflicts ? "font-medium text-destructive" : "text-muted-foreground"
          }`}
        >
          {dayBookingCount === 0
            ? "Žiadne rezervácie · celý deň je voľný"
            : `${dayBookingCount} ${pluralRezervacii(dayBookingCount)}`}
          {draftHasConflicts ? " · prekryv s novou" : ""}
        </p>
      )}
    </div>
  );

  /** Timeline body — the actual visual content (loading state, empty
   *  state, or the timeline grid). Wrapped in a `<>` so it can be
   *  conditionally mounted by the mobile collapsible without changing
   *  the rendered tree shape. */
  const dayPanelContent = (
    <>
      {!effectiveBarberId || !form.date ? (
        <p className="text-sm text-muted-foreground">Vyberte barbera a dátum.</p>
      ) : dayLoading || !combinedDay ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Načítavam…
        </div>
      ) : combinedDay.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Žiadne rezervácie. Celý deň je voľný.
        </p>
      ) : (
        <>
          {draftHasConflicts && (
            <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive">
              Nová rezervácia sa prekrýva s existujúcou.
            </p>
          )}
          {timelineLayout && (() => {
            // 0.8px/min → 48px per hour. Tight but readable; 30-min blocks
            // (24px) fit the title, 60-min blocks (48px) also show subtitle.
            const PX_PER_MIN = 0.8;
            const HOUR_GUTTER = 36;
            return (
              <div
                className="relative"
                style={{
                  height: `${timelineLayout.totalMin * PX_PER_MIN}px`,
                }}
              >
                {/* Hour labels (gutter) */}
                <div
                  className="absolute left-0 top-0 bottom-0"
                  style={{ width: `${HOUR_GUTTER}px` }}
                >
                  {timelineLayout.hours.map((mins) => (
                    <span
                      key={mins}
                      className="absolute right-2 -translate-y-1/2 text-[10px] font-mono tabular-nums text-muted-foreground"
                      style={{
                        top: `${(mins - timelineLayout.windowStart) * PX_PER_MIN}px`,
                      }}
                    >
                      {String(Math.floor(mins / 60) % 24).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>

                {/* Body — grid lines + appointments */}
                <div
                  className="absolute right-0 top-0 bottom-0"
                  style={{ left: `${HOUR_GUTTER}px` }}
                >
                  {/* Hour grid */}
                  {timelineLayout.hours.map((mins) => (
                    <div
                      key={mins}
                      className="absolute left-0 right-0 border-t border-border/30"
                      style={{
                        top: `${(mins - timelineLayout.windowStart) * PX_PER_MIN}px`,
                      }}
                    />
                  ))}

                  {/* Appointment blocks */}
                  {timelineLayout.items.map((a) => {
                    const top =
                      (a.startMin - timelineLayout.windowStart) * PX_PER_MIN;
                    const height = Math.max(
                      16,
                      (a.endMin - a.startMin) * PX_PER_MIN,
                    );
                    const conflictClass = a.isDraft
                      ? "border-dashed border-primary bg-primary/15"
                      : a.isConflict
                        ? "border-destructive/70 bg-destructive/15"
                        : "border-border/50 bg-muted/60";
                    const showSubtitle = height >= 30;
                    const subtitle = a.isDraft
                      ? "Nová rezervácia"
                      : `${a.source === "walk-in" ? "Walk-in" : a.serviceName}${
                          a.status !== "CONFIRMED" && a.status !== "PENDING"
                            ? ` · ${STATUS_LABELS[a.status]}`
                            : ""
                        }`;
                    return (
                      <div
                        key={a.id}
                        className={`absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${conflictClass}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${a.leftPct}% + 2px)`,
                          width: `calc(${a.widthPct}% - 4px)`,
                        }}
                        title={`${a.startTime}–${a.endTime} ${a.title}`}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                            {a.startTime}
                          </span>
                          <span className="truncate font-medium text-foreground">
                            {a.title}
                          </span>
                        </div>
                        {showSubtitle && (
                          <div
                            className={`truncate text-[10px] ${
                              a.isDraft
                                ? "text-primary-strong"
                                : a.isConflict
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {subtitle}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </>
  );

  /** Validate current form state — returns true if OK, otherwise sets the
   *  inline error and returns false. Used both before opening the confirm
   *  dialog (create mode) and as the fallback path for edit mode. */
  const validate = (): boolean => {
    if (limited) return true;
    if (!form.serviceId) {
      setError("Vyberte službu.");
      return false;
    }
    if (!effectiveBarberId) {
      setError("Vyberte barbera.");
      return false;
    }
    if (!form.date || !form.time) {
      setError("Vyberte dátum a čas.");
      return false;
    }
    if (!form.walkIn) {
      if (!form.firstName.trim()) {
        setError("Zadajte meno zákazníka.");
        return false;
      }
      if (!/^[1-9]\d{8}$/.test(form.phoneDigits)) {
        setError("Zadajte 9-miestne telefónne číslo bez úvodnej nuly (napr. 903123456).");
        return false;
      }
      // Email is required for create (so customer gets confirmation + reminder).
      // For edit it stays optional — legacy reservations may not have one.
      if (mode === "create" && !form.email.trim()) {
        setError("Email je povinný — zákazník dostane potvrdenie a pripomienku.");
        return false;
      }
    }
    return true;
  };

  const performSubmit = () => {
    startTransition(async () => {
      const fullPhone = form.walkIn
        ? ""
        : `${form.phonePrefix}${form.phoneDigits}`;
      const payload = {
        serviceId: form.serviceId,
        barberId: effectiveBarberId,
        date: form.date,
        time: form.time,
        firstName: form.walkIn ? "" : form.firstName.trim(),
        lastName: form.walkIn ? "" : form.lastName.trim(),
        phone: fullPhone,
        email: form.walkIn ? "" : form.email.trim(),
        notes: form.notes.trim(),
        ignoreSchedule: form.ignoreSchedule,
        walkIn: form.walkIn,
        label: form.walkIn ? form.label.trim() : "",
        customDurationMinutes:
          form.walkIn && form.customDurationMinutes.trim() !== ""
            ? Number(form.customDurationMinutes)
            : null,
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
        setConfirmOpen(false);
        setError(result.error ?? "Nastala chyba.");
        toast.error(result.error ?? "Nepodarilo sa uložiť rezerváciu");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    // Create gets a confirmation dialog (rezervácia odošle email/SMS, walk-in
    // blokuje slot — chcem ti dať sekundu na overenie). Edit + limited mode
    // submit directly; admin is just patching an existing record.
    if (mode === "create" && !limited) {
      setConfirmOpen(true);
      return;
    }
    performSubmit();
  };

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8"
    >
      <div className="space-y-6 lg:min-w-0">
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

      {/* Walk-in toggle — disabled in edit mode so admin can't flip an
          existing reservation in or out of walk-in (would orphan the
          customer record / invent a fake one). */}
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3">
        <div className="flex items-start gap-3">
          <Switch
            id="walkIn"
            checked={form.walkIn}
            onCheckedChange={(v) =>
              setForm((s) => ({
                ...s,
                walkIn: v,
                label: v && !s.label.trim() ? "Walk-in" : s.label,
              }))
            }
            disabled={limited || mode === "edit"}
          />
          <div className="flex-1">
            <Label htmlFor="walkIn" className="cursor-pointer">
              Walk-in / blokovaný čas
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bez kontaktných údajov — žiadny email, žiadna SMS pripomienka.
              Použite pre zákazníka bez čísla, ktorý príde osobne, alebo na
              zablokovanie vlastného času (obed, výjazd).
            </p>
          </div>
        </div>

        {/* Quick templates — pre-fill label + duration + ignoreSchedule
            for the most common blocking scenarios. Visible in create
            mode only (edit mode disallows changing walkIn anyway). */}
        {mode === "create" && !limited && (
          <div className="flex flex-wrap items-center gap-2 pl-[3.25rem]">
            <span className="text-xs text-muted-foreground">Rýchle:</span>
            {WALK_IN_TEMPLATES.map((tpl) => (
              <Button
                key={tpl.id}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyWalkInTemplate(tpl)}
                className="h-7 px-2 text-xs"
              >
                {tpl.label} · {tpl.durationMinutes}min
              </Button>
            ))}
          </div>
        )}
      </div>

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
            onClick={openNativePicker}
            onFocus={openNativePicker}
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
              onClick={openNativePicker}
              onFocus={openNativePicker}
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

      {/* Mobile-only inline day overview — collapsible to save vertical
          space. Header always visible (gives summary at a glance); the
          full timeline is hidden until the admin taps to expand. Forced
          open when the draft overlaps an existing booking so the warning
          isn't tucked away behind a click. */}
      <div
        aria-label="Rezervácie v zvolený deň"
        className="rounded-2xl border border-border/60 bg-card shadow-sm lg:hidden"
      >
        <button
          type="button"
          onClick={() => setDayPanelOpen((o) => !o)}
          aria-expanded={dayPanelOpen}
          className="flex w-full items-start justify-between gap-3 p-4 text-left"
        >
          {dayPanelHeader}
          <ChevronDownIcon
            className={`mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform ${
              dayPanelOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {dayPanelOpen && (
          <div className="border-t border-border/60 px-4 pb-4 pt-3">
            {dayPanelContent}
          </div>
        )}
      </div>

      {/* Zákazník — for walk-ins, the whole contact fieldset is replaced
          with a label + optional duration override. */}
      {form.walkIn ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label">Popis (voliteľné)</Label>
            <Input
              id="label"
              value={form.label}
              onChange={(e) => updateField("label", e.target.value)}
              placeholder={'napr. „Walk-in", „Mimo prevádzky", „Pán Novák"'}
              disabled={limited}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Zobrazí sa v zozname rezervácií namiesto mena zákazníka. Ak
              nezadáte popis, použije sa „Walk-in&quot;.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customDurationMinutes">
              Vlastné trvanie (min)
            </Label>
            <Input
              id="customDurationMinutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={720}
              step={5}
              placeholder="napr. 210 pre 3h 30min"
              value={form.customDurationMinutes}
              onChange={(e) =>
                updateField("customDurationMinutes", e.target.value)
              }
              disabled={limited}
            />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((hours) => {
                const value = String(hours * 60);
                const active = form.customDurationMinutes === value;
                return (
                  <Button
                    key={hours}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    disabled={limited}
                    onClick={() => updateField("customDurationMinutes", value)}
                  >
                    {hours}h
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Override pre dĺžku rezervácie 5–720 min. Prázdne = použije sa
              trvanie vybranej služby. Pre voľne zadaný čas zapnite
              „Ignorovať rozvrh&quot; — slot-picker nevie o vlastnom trvaní.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Zákazník
          </h3>
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
      )}

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
      </div>

      {/* Desktop sidebar — sticky, only visible on lg+. Always expanded
          since the sidebar has plenty of vertical space and stays visible
          as the admin scrolls. */}
      <aside
        aria-label="Rezervácie v zvolený deň"
        className="mt-8 hidden lg:sticky lg:top-6 lg:mt-0 lg:block"
      >
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="mb-3">{dayPanelHeader}</div>
          {dayPanelContent}
        </div>
      </aside>
    </form>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {form.walkIn ? "Vytvoriť walk-in / blok?" : "Vytvoriť rezerváciu?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Skontrolujte zhrnutie pred uložením.
            {!form.walkIn && " Zákazník dostane potvrdzujúci email."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{form.walkIn ? "Popis" : "Zákazník"}</dt>
          <dd className="font-medium text-foreground">{summaryWho}</dd>

          {!form.walkIn && form.phoneDigits && (
            <>
              <dt className="text-muted-foreground">Telefón</dt>
              <dd className="text-foreground tabular-nums">
                {form.phonePrefix} {form.phoneDigits}
              </dd>
            </>
          )}

          <dt className="text-muted-foreground">Služba</dt>
          <dd className="text-foreground">{summaryService}</dd>

          <dt className="text-muted-foreground">Barber</dt>
          <dd className="text-foreground">{summaryBarber}</dd>

          <dt className="text-muted-foreground">Dátum</dt>
          <dd className="text-foreground">{formattedDate}</dd>

          <dt className="text-muted-foreground">Čas</dt>
          <dd className="text-foreground tabular-nums">
            {draftEntry
              ? `${draftEntry.startTime} – ${draftEntry.endTime}`
              : form.time || "—"}
          </dd>

          {form.walkIn && form.customDurationMinutes && (
            <>
              <dt className="text-muted-foreground">Trvanie</dt>
              <dd className="text-foreground tabular-nums">
                {form.customDurationMinutes} min
                {(() => {
                  const h = formatDurationHours(Number(form.customDurationMinutes));
                  return h ? ` (${h})` : "";
                })()}
              </dd>
            </>
          )}

          {form.ignoreSchedule && (
            <>
              <dt className="text-muted-foreground">Režim</dt>
              <dd className="text-foreground">Ignorovať rozvrh a prekryv</dd>
            </>
          )}
        </dl>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Späť na úpravu</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog open while the action runs so the admin
              // can't double-click submit; performSubmit closes it on
              // error or navigates away on success.
              e.preventDefault();
              performSubmit();
            }}
            disabled={isPending}
          >
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Potvrdiť a vytvoriť
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
