"use client";

import {
  useReducer,
  useRef,
  useEffect,
  useMemo,
  useTransition,
  useCallback,
  useState,
} from "react";
import { addDays, endOfMonth, format, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { sk } from "date-fns/locale/sk";

const TIMEZONE = "Europe/Bratislava";
import {
  CheckCircle2Icon,
  Loader2Icon,
  ClockIcon,
  UserIcon,
  AlertCircleIcon,
  ScissorsIcon,
  CalendarCheckIcon,
  ChevronLeftIcon,
} from "lucide-react";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";

import { SectionWrapper } from "./section-wrapper";
import { TimeSlots } from "./time-slots";
import { ContactForm } from "./contact-form";
import { BookingSummary } from "./booking-summary";

import {
  fetchSlots,
  fetchWorkingDays,
  fetchScheduleEndTimes,
  fetchUpcomingOverrides,
} from "@/server/actions/slots";
import { createBooking } from "@/server/actions/booking";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BarberWithServices {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  serviceIds: string[];
  serviceOverrides: Record<string, { price?: string; duration?: number }>;
  bookingHorizonWeeks: number;
}

interface ServiceData {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
}

interface BookingWizardProps {
  services: ServiceData[];
  barbers: BarberWithServices[];
  initialServiceId?: string | null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ContactData {
  firstName: string;
  lastName: string;
  prefix: "+421" | "+420";
  phone: string;
  email: string;
  note: string;
}

interface WizardState {
  step: number;
  serviceId: string | null;
  barberId: string | null;
  date: string | null;
  time: string | null;
  contact: ContactData | null;
  slots: string[] | null;
  workingDays: number[] | null;
  scheduleEndTimes: Record<number, string> | null;
  /**
   * Date-keyed override availability. Set independently of workingDays so an
   * override can make a normally non-working day (e.g. Sunday) available, or
   * block a normally working day. Map<"YYYY-MM-DD", isAvailable>.
   */
  overrides: Record<string, boolean> | null;
  /** True when the schedule fetch on barber-select failed; the calendar
   *  shows a retry button instead of an indefinite spinner. */
  calendarError: boolean;
  loadingSlots: boolean;
  submitting: boolean;
  result: {
    success: boolean;
    error?: string;
    field?: "firstName" | "lastName" | "phone" | "email" | "note";
    appointmentId?: string;
    emailFailed?: boolean;
  } | null;
}

const initialState: WizardState = {
  step: 1,
  serviceId: null,
  barberId: null,
  date: null,
  time: null,
  contact: null,
  slots: null,
  workingDays: null,
  scheduleEndTimes: null,
  overrides: null,
  calendarError: false,
  loadingSlots: false,
  submitting: false,
  result: null,
};

// Builds the initial wizard state for a deep-link arriving with
// ?service=<id> (from /cennik or /sluzby/[slug]). Pre-advances the
// step so the user lands directly on barber/date selection instead
// of seeing step 1 flash before jumping.
function buildInitialState(
  initialServiceId: string | null,
  services: ServiceData[],
  barbers: BarberWithServices[]
): WizardState {
  if (!initialServiceId) return initialState;
  if (!services.some((s) => s.id === initialServiceId)) return initialState;

  const available = barbers.filter((b) =>
    b.serviceIds.includes(initialServiceId)
  );
  if (available.length === 1) {
    return {
      ...initialState,
      step: 3,
      serviceId: initialServiceId,
      barberId: available[0].id,
    };
  }
  return {
    ...initialState,
    step: 2,
    serviceId: initialServiceId,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type WizardAction =
  | { type: "SELECT_SERVICE"; serviceId: string }
  | { type: "SELECT_BARBER"; barberId: string }
  | { type: "SELECT_DATE"; date: string }
  | { type: "SELECT_TIME"; time: string }
  | { type: "SET_CONTACT"; contact: ContactData }
  | { type: "SET_SLOTS"; slots: string[] }
  | { type: "SET_WORKING_DAYS"; workingDays: number[] }
  | { type: "SET_SCHEDULE_END_TIMES"; endTimes: Record<number, string> }
  | { type: "SET_OVERRIDES"; overrides: Record<string, boolean> }
  | { type: "SET_CALENDAR_ERROR"; error: boolean }
  | { type: "SET_LOADING_SLOTS"; loading: boolean }
  | { type: "SUBMIT_START" }
  | {
      type: "SUBMIT_RESULT";
      result: {
        success: boolean;
        error?: string;
        field?: "firstName" | "lastName" | "phone" | "email" | "note";
        appointmentId?: string;
        emailFailed?: boolean;
      };
    }
  | { type: "EDIT_STEP"; step: number };

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SELECT_SERVICE":
      return {
        ...state,
        step: 2,
        serviceId: action.serviceId,
        barberId: null,
        date: null,
        time: null,
        slots: null,
        workingDays: null,
        scheduleEndTimes: null,
        result: null,
      };

    case "SELECT_BARBER":
      return {
        ...state,
        step: 3,
        barberId: action.barberId,
        date: null,
        time: null,
        slots: null,
        result: null,
      };

    case "SELECT_DATE":
      return {
        ...state,
        step: 4,
        date: action.date,
        time: null,
        slots: null,
        result: null,
      };

    case "SELECT_TIME":
      return {
        ...state,
        step: 5,
        time: action.time,
        result: null,
      };

    case "SET_CONTACT":
      return {
        ...state,
        step: 6,
        contact: action.contact,
        result: null,
      };

    case "SET_SLOTS":
      return { ...state, slots: action.slots, loadingSlots: false };

    case "SET_WORKING_DAYS":
      return { ...state, workingDays: action.workingDays };

    case "SET_SCHEDULE_END_TIMES":
      return { ...state, scheduleEndTimes: action.endTimes };

    case "SET_OVERRIDES":
      return { ...state, overrides: action.overrides };

    case "SET_CALENDAR_ERROR":
      return { ...state, calendarError: action.error };

    case "SET_LOADING_SLOTS":
      return { ...state, loadingSlots: action.loading };

    case "SUBMIT_START":
      return { ...state, submitting: true, result: null };

    case "SUBMIT_RESULT":
      return { ...state, submitting: false, result: action.result };

    case "EDIT_STEP": {
      const s = action.step;
      return {
        ...state,
        step: s,
        result: null,
        ...(s <= 1 && {
          serviceId: null,
          barberId: null,
          date: null,
          time: null,
          slots: null,
          workingDays: null,
          scheduleEndTimes: null,
          overrides: null,
        }),
        ...(s === 2 && {
          barberId: null,
          date: null,
          time: null,
          slots: null,
          workingDays: null,
          scheduleEndTimes: null,
          overrides: null,
        }),
        ...(s === 3 && {
          date: null,
          time: null,
          slots: null,
        }),
        ...(s === 4 && {
          time: null,
        }),
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 6;

/** Format phone for display: "+421 903123456" → "+421 903 123 456" */
function formatPhoneDisplay(prefix: string, phone: string): string {
  const formatted = phone.replace(/(\d{3})(?=\d)/g, "$1 ");
  return `${prefix} ${formatted}`.trim();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookingWizard({
  services,
  barbers,
  initialServiceId = null,
}: BookingWizardProps) {
  const [state, dispatch] = useReducer(reducer, null, () =>
    buildInitialState(initialServiceId, services, barbers)
  );
  const [isPending, startTransition] = useTransition();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsHint, setShowTermsHint] = useState(false);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const sectionRefs = useRef<Array<HTMLDivElement | null>>(
    Array(TOTAL_STEPS + 1).fill(null)
  );

  // Pre-build a stable callback per step (1..TOTAL_STEPS). Avoids the
  // previous lazy "create callback on first render" pattern which the
  // react-hooks plugin (v7+) flags as "cannot access refs during render".
  const sectionRefCallbacks = useMemo(
    () =>
      Array.from({ length: TOTAL_STEPS + 1 }, (_, step) =>
        (el: HTMLDivElement | null) => {
          sectionRefs.current[step] = el;
        }
      ),
    []
  );
  const setSectionRef = (step: number) => sectionRefCallbacks[step];

  // Per-fetch sequence ids so a fast user (barber A → barber B before
  // A's response landed, or date A → date B before A's slots came back)
  // can't have the late response overwrite the active selection's
  // freshly-loaded data. Bumped on every entry; the async block discards
  // its result if the ref has moved on.
  const calendarFetchIdRef = useRef(0);
  const slotsFetchIdRef = useRef(0);

  // Defined here (above useEffects that depend on it) so the deps array
  // doesn't read it through the temporal dead zone on first render.
  // Errors are explicitly caught and surfaced via SET_CALENDAR_ERROR — a
  // silent swallow used to leave the calendar stuck on "Načítavam..." if
  // any of the three parallel server actions failed (network blip, cold
  // start, transient Firestore error).
  const loadBarberCalendar = useCallback((barberId: string) => {
    const myId = ++calendarFetchIdRef.current;
    dispatch({ type: "SET_CALENDAR_ERROR", error: false });
    startTransition(async () => {
      try {
        const [days, endTimes, dateOverrides] = await Promise.all([
          fetchWorkingDays(barberId),
          fetchScheduleEndTimes(barberId),
          fetchUpcomingOverrides(barberId),
        ]);
        if (calendarFetchIdRef.current !== myId) return; // superseded
        dispatch({ type: "SET_WORKING_DAYS", workingDays: days });
        dispatch({ type: "SET_SCHEDULE_END_TIMES", endTimes });
        dispatch({
          type: "SET_OVERRIDES",
          overrides: Object.fromEntries(
            dateOverrides.map((o) => [o.date, o.isAvailable])
          ),
        });
      } catch (err) {
        if (calendarFetchIdRef.current !== myId) return;
        console.error("[booking-wizard] schedule fetch failed", err);
        dispatch({ type: "SET_CALENDAR_ERROR", error: true });
      }
    });
  }, []);

  // Deep-link from /cennik or /sluzby/[slug]: when the wizard mounts with
  // a pre-selected barber (single-barber service), fetch the calendar so
  // step 3 doesn't get stuck on "Načítavam rozvrh...". One-shot via ref
  // so the user can navigate back to step 1 without re-firing the fetch.
  const calendarPrefetchedRef = useRef(false);
  useEffect(() => {
    if (calendarPrefetchedRef.current) return;
    if (!state.barberId) return;
    calendarPrefetchedRef.current = true;
    loadBarberCalendar(state.barberId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sectionRefs.current[state.step];
    if (!el) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        const rect = el.getBoundingClientRect();
        const margin = 24;
        if (rect.top < 0 || rect.top > window.innerHeight * 0.4) {
          const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches;
          window.scrollTo({
            top: window.scrollY + rect.top - margin,
            behavior: prefersReducedMotion ? "auto" : "smooth",
          });
        }
      });
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.step]);

  // Reset terms checkbox when service/barber changes (price may differ).
  // react-hooks/set-state-in-effect flags any sync setState in an effect.
  // Here the resets don't cascade (the deps don't include the states
  // being set), so the warning is a false positive.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTermsAccepted(false);
    setShowTermsHint(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state.serviceId, state.barberId]);

  // Show terms hint after a short delay once user reaches the confirm step.
  useEffect(() => {
    if (state.step === TOTAL_STEPS) {
      const timer = setTimeout(() => {
        setShowTermsHint(true);
      }, 10000);
      return () => clearTimeout(timer);
    }
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setShowTermsHint(false);
  }, [state.step]);

  // Refresh calendar/slot disabled-state once a minute. Previously a
  // single midnight setTimeout fired once per page-life; after the
  // first midnight the timer was never rescheduled and the calendar
  // showed yesterday as bookable for any tab kept open across two
  // midnights. The `currentMinutes` derivation also stayed stuck, so
  // "today is past end-of-day" stopped updating during a long session.
  const [, forceRender] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceRender((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const selectedService = services.find((s) => s.id === state.serviceId);
  const selectedBarber = barbers.find((b) => b.id === state.barberId);
  const availableBarbers = state.serviceId
    ? barbers.filter((b) => b.serviceIds.includes(state.serviceId!))
    : [];

  // Effective price/duration (barber custom overrides > base service)
  const overrides =
    selectedBarber && state.serviceId
      ? selectedBarber.serviceOverrides[state.serviceId]
      : undefined;
  const effectivePrice = overrides?.price ?? selectedService?.price;
  const effectiveDuration =
    overrides?.duration ?? selectedService?.durationMinutes;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSelectService = useCallback(
    (serviceId: string) => {
      dispatch({ type: "SELECT_SERVICE", serviceId });

      // Auto-select barber if only one is available for this service
      const available = barbers.filter((b) => b.serviceIds.includes(serviceId));
      if (available.length === 1) {
        const barberId = available[0].id;
        dispatch({ type: "SELECT_BARBER", barberId });
        loadBarberCalendar(barberId);
      }
    },
    [barbers, loadBarberCalendar]
  );

  const handleSelectBarber = useCallback(
    (barberId: string) => {
      dispatch({ type: "SELECT_BARBER", barberId });
      loadBarberCalendar(barberId);
    },
    [loadBarberCalendar]
  );

  const handleSelectDate = useCallback(
    (date: Date | undefined) => {
      if (!date || !state.barberId || !state.serviceId) return;
      const dateStr = format(date, "yyyy-MM-dd");
      const myId = ++slotsFetchIdRef.current;
      dispatch({ type: "SELECT_DATE", date: dateStr });
      dispatch({ type: "SET_LOADING_SLOTS", loading: true });
      startTransition(async () => {
        try {
          const slots = await fetchSlots(
            state.barberId!,
            state.serviceId!,
            dateStr
          );
          if (slotsFetchIdRef.current !== myId) return; // superseded
          dispatch({ type: "SET_SLOTS", slots });
        } catch (err) {
          if (slotsFetchIdRef.current !== myId) return;
          console.error("[booking-wizard] slot fetch failed", err);
          dispatch({ type: "SET_SLOTS", slots: [] });
        }
      });
    },
    [state.barberId, state.serviceId]
  );

  const handleSelectTime = useCallback((time: string) => {
    dispatch({ type: "SELECT_TIME", time });
  }, []);

  const handleContactSubmit = useCallback((data: ContactData) => {
    dispatch({ type: "SET_CONTACT", contact: data });
  }, []);

  // Synchronous lock against double-submit. React state updates are
  // batched, so two rapid clicks on the retry button could both pass
  // the `disabled={state.submitting}` check before the next render set
  // it to true. A ref flips synchronously and prevents the second call
  // from issuing a duplicate booking POST.
  const inFlightRef = useRef(false);

  const handleSubmitBooking = useCallback(async () => {
    if (
      !state.serviceId ||
      !state.barberId ||
      !state.date ||
      !state.time ||
      !state.contact
    )
      return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    dispatch({ type: "SUBMIT_START" });
    startTransition(async () => {
      try {
        const result = await createBooking({
          serviceId: state.serviceId,
          barberId: state.barberId,
          date: state.date,
          time: state.time,
          firstName: state.contact!.firstName,
          lastName: state.contact!.lastName,
          phone: `${state.contact!.prefix}${state.contact!.phone}`,
          email: state.contact!.email,
          note: state.contact!.note,
          website: honeypotRef.current?.value ?? "",
        });
        dispatch({ type: "SUBMIT_RESULT", result });
      } finally {
        inFlightRef.current = false;
      }
    });
  }, [
    state.serviceId,
    state.barberId,
    state.date,
    state.time,
    state.contact,
  ]);

  const handleEdit = useCallback((step: number) => {
    dispatch({ type: "EDIT_STEP", step });
  }, []);

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------

  // Scroll to top on success
  useEffect(() => {
    if (state.result?.success) {
      window.scrollTo({ top: 0 });
    }
  }, [state.result?.success]);

  if (state.result?.success) {
    const formattedDate = state.date
      ? format(parseISO(state.date), "EEEE, d. MMMM yyyy", { locale: sk })
      : "";

    return (
      <div aria-live="polite" className="space-y-3">
        {/* Completed progress bar */}
        <div className="flex items-center gap-3 px-1">
          <div className="size-11" />
          <div className="flex flex-1 items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-0 rounded-full bg-primary" />
              </div>
            ))}
          </div>
          <span className="text-[13px] tabular-nums text-muted-foreground">
            {TOTAL_STEPS}/{TOTAL_STEPS}
          </span>
        </div>

        <div className="mx-auto max-w-md py-4 text-center">
          <div className="rounded-2xl border border-border/60 bg-card p-8">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-green-500/15">
              <CalendarCheckIcon className="size-10 text-green-400" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-foreground">
              Rezervácia potvrdená!
            </h2>
            {state.result?.emailFailed ? (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-left text-[13px] text-amber-200"
              >
                <p className="font-medium">
                  Potvrdzujúci email sa nepodarilo odoslať.
                </p>
                <p className="mt-1 leading-snug">
                  Vaša rezervácia je uložená — uložte si prosím detaily
                  nižšie alebo nás kontaktujte, ak potrebujete cancel
                  link.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[15px] text-muted-foreground">
                Potvrdenie sme odoslali na váš email.
              </p>
            )}

            <div className="mt-6 space-y-3 rounded-xl bg-muted/50 p-4 text-left text-[15px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Služba</span>
                <span className="font-medium text-foreground">
                  {selectedService?.name}
                </span>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Barber</span>
                <span className="font-medium text-foreground">
                  {selectedBarber
                    ? `${selectedBarber.firstName} ${selectedBarber.lastName}`
                    : ""}
                </span>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Termín</span>
                <span className="text-right font-medium text-foreground">
                  {formattedDate}, {state.time}
                </span>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-foreground">Cena</span>
                <span className="text-lg font-bold text-primary tabular-nums">
                  {parseFloat(effectivePrice ?? selectedService?.price ?? "0").toFixed(0)} €
                </span>
              </div>
            </div>

            <Button
              className="mt-6 w-full"
              size="lg"
              onClick={() => window.location.reload()}
            >
              Nová rezervácia
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error block
  // ---------------------------------------------------------------------------

  const errorBlock = state.result && !state.result.success && (
    <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <AlertCircleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-destructive">
          {state.result.error || "Nastala neočakávaná chyba."}
        </p>
        {state.result.field ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => handleEdit(5)}
          >
            Upraviť kontaktné údaje
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handleSubmitBooking}
            disabled={state.submitting || isPending}
          >
            Skúsiť znova
          </Button>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Calendar helpers
  // ---------------------------------------------------------------------------

  // All "today / now" comparisons run against Europe/Bratislava — the
  // server stores startDateKey in that zone and the override map is
  // keyed the same way, so a customer browsing from a different TZ at
  // 23:30 their time would otherwise see the calendar disagree with
  // what the server is willing to book.
  const todayKey = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const todayStart = parseISO(todayKey); // UTC-midnight stand-in for the calendar's startMonth prop
  const nowBratislava = toZonedTime(new Date(), TIMEZONE);
  const currentMinutes =
    nowBratislava.getHours() * 60 + nowBratislava.getMinutes();

  // Booking horizon — read from selected barber, fallback to 3 weeks if barber
  // hasn't been selected yet (matches server-side default in createBooking).
  const horizonWeeks = selectedBarber?.bookingHorizonWeeks ?? 3;
  const horizonEndKey = formatInTimeZone(
    addDays(parseISO(todayKey), horizonWeeks * 7),
    TIMEZONE,
    "yyyy-MM-dd"
  );
  const calendarToMonth = endOfMonth(parseISO(horizonEndKey));

  const calendarDisabledMatcher = (date: Date) => {
    // The Date received from react-day-picker is local-midnight of the
    // user's clicked day; format() in the user's TZ gives us the
    // YYYY-MM-DD of what they actually picked, which is what the server
    // will see as `data.date`.
    const dateKey = format(date, "yyyy-MM-dd");
    if (dateKey < todayKey) return true;
    if (dateKey > horizonEndKey) return true;
    // Block ALL days until working days are loaded from the server
    if (!state.workingDays) return true;

    // Per-date override wins over the weekly schedule. This makes a
    // normally non-working day (e.g. Sunday) selectable when the barber
    // explicitly added a custom-hours override for it, and conversely
    // blocks a normally working day marked as a "day off".
    const override = state.overrides?.[dateKey];
    if (override === false) return true;       // explicit day off
    if (override === true) return false;       // custom-hours override

    const dayOfWeek = date.getDay();
    if (!state.workingDays.includes(dayOfWeek)) return true;
    // Disable today if current time (in Bratislava) is past the barber's schedule end.
    if (dateKey === todayKey && state.scheduleEndTimes?.[dayOfWeek]) {
      const [endH, endM] = state.scheduleEndTimes[dayOfWeek]
        .split(":")
        .map(Number);
      if (currentMinutes >= endH * 60 + endM) return true;
    }
    return false;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-3">
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        defaultValue=""
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
      {/* Progress indicator */}
      <div className="flex items-center gap-3 px-1">
        <button
          type="button"
          onClick={() => handleEdit(state.step - 1)}
          disabled={state.step <= 1}
          className={cn(
            "flex size-11 items-center justify-center rounded-lg transition-colors active:scale-95",
            state.step > 1
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "pointer-events-none opacity-0"
          )}
          aria-label="Späť"
        >
          <ChevronLeftIcon className="size-6" />
        </button>
        <div
          className="flex flex-1 items-center gap-1.5"
          role="progressbar"
          aria-valuenow={state.step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label={`Krok ${state.step} z ${TOTAL_STEPS}`}
        >
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const filled = i + 1 <= state.step;
            return (
              <div
                key={i}
                className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn(
                    "absolute inset-0 rounded-full bg-primary transition-all duration-500",
                    filled ? "w-full" : "w-0"
                  )}
                />
              </div>
            );
          })}
        </div>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {state.step}/{TOTAL_STEPS}
        </span>
      </div>

      {/* 1 — Služba */}
      <SectionWrapper
        ref={setSectionRef(1)}
        stepNumber={1}
        title="Služba"
        isActive={state.step === 1}
        isCompleted={state.step > 1}
        completedSummary={
          selectedService
            ? `${selectedService.name} — ${parseFloat(effectivePrice ?? selectedService.price).toFixed(0)} €`
            : undefined
        }
        onEdit={() => handleEdit(1)}
      >
        <div className="space-y-2">
          {services.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Momentálne nie sú dostupné žiadne služby.</p>
          ) : (
            services.map((service) => (
              <ServiceCardWizard
                key={service.id}
                name={service.name}
                description={service.description}
                durationMinutes={service.durationMinutes}
                price={service.price}
                isSelected={state.serviceId === service.id}
                onClick={() => handleSelectService(service.id)}
              />
            ))
          )}
        </div>
      </SectionWrapper>

      {/* 2 — Barber */}
      <SectionWrapper
        ref={setSectionRef(2)}
        stepNumber={2}
        title="Barber"
        isActive={state.step === 2}
        isCompleted={state.step > 2}
        completedSummary={
          selectedBarber
            ? `${selectedBarber.firstName} ${selectedBarber.lastName}`
            : undefined
        }
        onEdit={() => handleEdit(2)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {availableBarbers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground sm:col-span-2">Pre túto službu nie sú dostupní žiadni barberi.</p>
          ) : (
            availableBarbers.map((barber) => (
              <BarberCardWizard
                key={barber.id}
                firstName={barber.firstName}
                lastName={barber.lastName}
                bio={barber.bio}
                avatarUrl={barber.avatarUrl}
                isSelected={state.barberId === barber.id}
                onClick={() => handleSelectBarber(barber.id)}
              />
            ))
          )}
        </div>
      </SectionWrapper>

      {/* 3 — Dátum */}
      <SectionWrapper
        ref={setSectionRef(3)}
        stepNumber={3}
        title="Dátum"
        isActive={state.step === 3}
        isCompleted={state.step > 3}
        completedSummary={
          state.date
            ? format(parseISO(state.date), "EEEE, d. MMMM", { locale: sk })
            : undefined
        }
        onEdit={() => handleEdit(3)}
      >
        {state.calendarError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-8 text-center text-[15px]"
          >
            <AlertCircleIcon className="size-6 text-destructive" />
            <p className="font-medium text-destructive">
              Nepodarilo sa načítať rozvrh.
            </p>
            <p className="text-[13px] text-muted-foreground">
              Skontrolujte pripojenie a skúste znova.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => state.barberId && loadBarberCalendar(state.barberId)}
              disabled={!state.barberId}
            >
              Skúsiť znova načítať rozvrh
            </Button>
          </div>
        ) : !state.workingDays ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-10 text-[15px] text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin text-primary" />
            <span>Načítavam rozvrh...</span>
          </div>
        ) : (
          <div className="booking-calendar">
            <Calendar
              mode="single"
              locale={sk}
              selected={state.date ? parseISO(state.date) : undefined}
              onSelect={handleSelectDate}
              disabled={calendarDisabledMatcher}
              startMonth={todayStart}
              endMonth={calendarToMonth}
            />
          </div>
        )}
      </SectionWrapper>

      {/* 4 — Čas */}
      <SectionWrapper
        ref={setSectionRef(4)}
        stepNumber={4}
        title="Čas"
        isActive={state.step === 4}
        isCompleted={state.step > 4}
        completedSummary={state.time ?? undefined}
        onEdit={() => handleEdit(4)}
      >
        {state.loadingSlots ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-10 text-[15px] text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin text-primary" />
            <span>Načítavam voľné termíny...</span>
          </div>
        ) : state.slots ? (
          <TimeSlots
            slots={state.slots}
            selectedTime={state.time}
            onSelect={handleSelectTime}
            onChangeDate={() => handleEdit(3)}
          />
        ) : null}
      </SectionWrapper>

      {/* 5 — Kontaktné údaje */}
      <SectionWrapper
        ref={setSectionRef(5)}
        stepNumber={5}
        title="Kontaktné údaje"
        isActive={state.step === 5}
        isCompleted={state.step > 5}
        completedSummary={
          state.contact
            ? `${state.contact.firstName} ${state.contact.lastName}`
            : undefined
        }
        onEdit={() => handleEdit(5)}
      >
        <ContactForm
          onSubmit={handleContactSubmit}
          defaultValues={state.contact ?? undefined}
          serverError={
            state.result &&
            !state.result.success &&
            state.result.field &&
            state.result.error
              ? { field: state.result.field, message: state.result.error }
              : null
          }
        />
      </SectionWrapper>

      {/* 6 — Potvrdenie */}
      <SectionWrapper
        ref={setSectionRef(6)}
        stepNumber={6}
        title="Potvrdenie"
        isActive={state.step === 6}
        isCompleted={false}
      >
        {selectedService && selectedBarber && state.date && state.time && (
          <>
            <BookingSummary
              serviceName={selectedService.name}
              barberName={`${selectedBarber.firstName} ${selectedBarber.lastName}`}
              date={format(parseISO(state.date), "EEEE, d. MMMM yyyy", {
                locale: sk,
              })}
              time={state.time}
              duration={effectiveDuration ?? selectedService.durationMinutes}
              price={parseFloat(effectivePrice ?? selectedService.price).toFixed(0)}
              contactName={state.contact ? `${state.contact.firstName} ${state.contact.lastName}`.trim() : undefined}
              contactPhone={state.contact ? formatPhoneDisplay(state.contact.prefix, state.contact.phone) : undefined}
              contactEmail={state.contact?.email || undefined}
            />

            {/* Terms checkbox — visually emphasised so users notice the
                consent gate before tapping the disabled submit button. */}
            <label
              className={cn(
                "mt-5 flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors",
                termsAccepted
                  ? "border-primary/50 bg-primary/5"
                  : "border-primary/40 bg-primary/5 ring-2 ring-primary/15",
                showTermsHint &&
                  !termsAccepted &&
                  "border-destructive/60 bg-destructive/5 ring-destructive/20 motion-safe:animate-pulse"
              )}
            >
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                aria-label="Súhlasím s obchodnými podmienkami a zásadami ochrany osobných údajov"
                aria-required="true"
                className="mt-0.5 size-5 shrink-0"
              />
              <span
                className={cn(
                  "text-[15px] font-medium leading-snug",
                  termsAccepted ? "text-foreground" : "text-foreground"
                )}
              >
                Súhlasím s{" "}
                <Link
                  href="/vop"
                  target="_blank"
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  obchodnými podmienkami
                </Link>{" "}
                a{" "}
                <Link
                  href="/ochrana-udajov"
                  target="_blank"
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  zásadami ochrany osobných údajov
                </Link>
                .{!termsAccepted && (
                  <span className="ml-1 text-destructive">*</span>
                )}
              </span>
            </label>
            {showTermsHint && !termsAccepted && state.step === TOTAL_STEPS && (
              <p
                role="alert"
                className="mt-2 flex items-center gap-1.5 text-sm font-medium text-destructive"
              >
                <AlertCircleIcon className="size-4" />
                Pred potvrdením musíte zaškrtnúť súhlas vyššie.
              </p>
            )}

            {errorBlock}

            <Button
              className="mt-5 h-12 w-full text-base font-semibold"
              size="lg"
              disabled={state.submitting || isPending || !termsAccepted}
              onClick={handleSubmitBooking}
            >
              {state.submitting || isPending ? (
                <>
                  <Loader2Icon className="size-5 animate-spin" />
                  Odosielam...
                </>
              ) : (
                "Potvrdiť rezerváciu"
              )}
            </Button>
          </>
        )}
      </SectionWrapper>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ServiceCard
// ---------------------------------------------------------------------------

interface ServiceCardWizardProps {
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  isSelected: boolean;
  onClick: () => void;
}

function ServiceCardWizard({
  name,
  description,
  durationMinutes,
  price,
  isSelected,
  onClick,
}: ServiceCardWizardProps) {
  const priceNum = parseFloat(price);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] sm:p-4",
        isSelected
          ? "border-primary/60 bg-primary/10 shadow-sm"
          : "border-border/40 bg-muted/30 hover:border-border/70 hover:bg-muted/50"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
          isSelected
            ? "bg-primary/20 text-primary"
            : "bg-muted/50 text-muted-foreground"
        )}
      >
        <ScissorsIcon className="size-5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[17px] font-semibold leading-tight text-foreground">{name}</h3>
          <span className="shrink-0 text-[15px] font-bold text-primary tabular-nums">
            {priceNum.toFixed(0)} €
          </span>
        </div>
        {description && (
          <p className="mt-1 text-[15px] leading-snug text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1 text-[13px] text-muted-foreground">
          <ClockIcon className="size-4" />
          {durationMinutes} min
        </div>
      </div>

      {/* Check */}
      {isSelected && (
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
          <CheckCircle2Icon className="size-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// BarberCard
// ---------------------------------------------------------------------------

interface BarberCardWizardProps {
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  isSelected: boolean;
  onClick: () => void;
}

function BarberCardWizard({
  firstName,
  lastName,
  bio,
  avatarUrl,
  isSelected,
  onClick,
}: BarberCardWizardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center gap-3 rounded-xl border p-5 text-center transition-all active:scale-[0.98]",
        isSelected
          ? "border-primary/60 bg-primary/10 shadow-sm"
          : "border-border/40 bg-muted/30 hover:border-border/70 hover:bg-muted/50"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full",
          isSelected ? "ring-3 ring-primary" : "ring-1 ring-border/60"
        )}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`${firstName} ${lastName}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <UserIcon className="size-10 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        <h3 className="text-[17px] font-semibold leading-tight text-foreground">
          {firstName} {lastName}
        </h3>
        {bio && (
          <p className="mt-1 text-[15px] leading-snug text-muted-foreground">
            {bio}
          </p>
        )}
      </div>

      {/* Hint / Check */}
      {isSelected ? (
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
          <CheckCircle2Icon className="size-4 text-primary-foreground" />
        </div>
      ) : (
        <span className="mt-1 text-[13px] font-medium text-primary/70">
          Klikni pre výber →
        </span>
      )}
    </button>
  );
}
