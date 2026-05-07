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
  InfoIcon,
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

import { fetchAvailability } from "@/server/actions/slots";
import type { AvailabilityBundle } from "@/server/queries/slots";
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
  /**
   * SSR-prefetched availability for the deep-link case where (?service=X)
   * resolves to a single barber. When present, the wizard hydrates the
   * calendar + slot map without a client round-trip — first paint already
   * has working days marked and any clicked date resolves slots instantly.
   */
  initialAvailability?: AvailabilityBundle | null;
  /** Barber the prefetched availability belongs to. Only honored if it
   *  matches the auto-selected barber for `initialServiceId`. */
  initialAvailabilityBarberId?: string | null;
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
  workingDays: number[] | null;
  scheduleEndTimes: Record<number, string> | null;
  /**
   * Date-keyed override availability. Set independently of workingDays so an
   * override can make a normally non-working day (e.g. Sunday) available, or
   * block a normally working day. Map<"YYYY-MM-DD", isAvailable>.
   */
  overrides: Record<string, boolean> | null;
  /**
   * Pre-computed slot list for every date in the booking horizon. Loaded in
   * one batch alongside the calendar inputs (workingDays/end-times/overrides),
   * so a date click resolves synchronously — no per-day server round-trip.
   */
  slotsByDate: Record<string, string[]> | null;
  /** True when the schedule fetch on barber-select failed; the calendar
   *  shows a retry button instead of an indefinite spinner. */
  calendarError: boolean;
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
  workingDays: null,
  scheduleEndTimes: null,
  overrides: null,
  slotsByDate: null,
  calendarError: false,
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
  barbers: BarberWithServices[],
  initialAvailability: AvailabilityBundle | null,
  initialAvailabilityBarberId: string | null
): WizardState {
  if (!initialServiceId) return initialState;
  if (!services.some((s) => s.id === initialServiceId)) return initialState;

  const available = barbers.filter((b) =>
    b.serviceIds.includes(initialServiceId)
  );
  if (available.length === 1) {
    const barberId = available[0].id;
    // The SSR prefetch only counts when its barber matches the one we're
    // about to auto-select — guards against stale bundles arriving from a
    // different deep-link path.
    const seedBundle =
      initialAvailability && initialAvailabilityBarberId === barberId
        ? initialAvailability
        : null;
    return {
      ...initialState,
      step: 3,
      serviceId: initialServiceId,
      barberId,
      workingDays: seedBundle?.workingDays ?? null,
      scheduleEndTimes: seedBundle?.scheduleEndTimes ?? null,
      overrides: seedBundle?.overrides ?? null,
      slotsByDate: seedBundle?.slotsByDate ?? null,
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
  | {
      type: "SET_AVAILABILITY";
      bundle: {
        workingDays: number[];
        scheduleEndTimes: Record<number, string>;
        overrides: Record<string, boolean>;
        slotsByDate: Record<string, string[]>;
      };
    }
  | { type: "SET_CALENDAR_ERROR"; error: boolean }
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
      // The bundle's slotsByDate is service-dependent (duration + buffer),
      // so a service change must invalidate the cached slots even if the
      // barber stays the same.
      return {
        ...state,
        step: 2,
        serviceId: action.serviceId,
        barberId: null,
        date: null,
        time: null,
        workingDays: null,
        scheduleEndTimes: null,
        overrides: null,
        slotsByDate: null,
        result: null,
      };

    case "SELECT_BARBER":
      return {
        ...state,
        step: 3,
        barberId: action.barberId,
        date: null,
        time: null,
        workingDays: null,
        scheduleEndTimes: null,
        overrides: null,
        slotsByDate: null,
        result: null,
      };

    case "SELECT_DATE":
      // Date+time are now a single step (3 = "Dátum a čas"), so picking a
      // date doesn't advance — it just reveals the slot grid below the
      // calendar. The user advances by picking a slot.
      return {
        ...state,
        date: action.date,
        time: null,
        result: null,
      };

    case "SELECT_TIME":
      return {
        ...state,
        step: 4,
        time: action.time,
        result: null,
      };

    case "SET_CONTACT":
      return {
        ...state,
        step: 5,
        contact: action.contact,
        result: null,
      };

    case "SET_AVAILABILITY":
      return {
        ...state,
        workingDays: action.bundle.workingDays,
        scheduleEndTimes: action.bundle.scheduleEndTimes,
        overrides: action.bundle.overrides,
        slotsByDate: action.bundle.slotsByDate,
        calendarError: false,
      };

    case "SET_CALENDAR_ERROR":
      return { ...state, calendarError: action.error };

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
          workingDays: null,
          scheduleEndTimes: null,
          overrides: null,
          slotsByDate: null,
        }),
        ...(s === 2 && {
          barberId: null,
          date: null,
          time: null,
          workingDays: null,
          scheduleEndTimes: null,
          overrides: null,
          slotsByDate: null,
        }),
        ...(s === 3 && {
          // Combined Dátum + čas: clear both. Calendar + slot grid show
          // again so the user can re-pick from scratch.
          date: null,
          time: null,
        }),
        // s === 4 (Kontakt) and s === 5 (Potvrdenie) clear nothing — the
        // user already typed their contact details and we want them
        // preserved when they go back to edit an earlier step.
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 5;

const STEP_LABELS: Record<number, string> = {
  1: "Vyberte si službu",
  2: "Vyberte si barbera",
  3: "Vyberte si dátum a čas",
  4: "Vaše kontaktné údaje",
  5: "Potvrdenie rezervácie",
};

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
  initialAvailability = null,
  initialAvailabilityBarberId = null,
}: BookingWizardProps) {
  const [state, dispatch] = useReducer(reducer, null, () =>
    buildInitialState(
      initialServiceId,
      services,
      barbers,
      initialAvailability,
      initialAvailabilityBarberId
    )
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

  // Per-fetch sequence id so a fast user (barber A → barber B before
  // A's response landed) can't have the late response overwrite the
  // active selection's freshly-loaded data. Bumped on every entry; the
  // async block discards its result if the ref has moved on.
  const availabilityFetchIdRef = useRef(0);

  // Single bulk fetch for the wizard's calendar AND every date's slots.
  // Defined above the useEffects that depend on it so the deps array
  // doesn't read it through the temporal dead zone on first render.
  // Errors are explicitly caught and surfaced via SET_CALENDAR_ERROR — a
  // silent swallow used to leave the calendar stuck on "Načítavam..." if
  // the parallel reads failed (network blip, cold start, transient
  // Firestore error).
  const loadBarberAvailability = useCallback(
    (barberId: string, serviceId: string) => {
      const myId = ++availabilityFetchIdRef.current;
      dispatch({ type: "SET_CALENDAR_ERROR", error: false });
      startTransition(async () => {
        try {
          const bundle = await fetchAvailability(barberId, serviceId);
          if (availabilityFetchIdRef.current !== myId) return; // superseded
          dispatch({
            type: "SET_AVAILABILITY",
            bundle: {
              workingDays: bundle.workingDays,
              scheduleEndTimes: bundle.scheduleEndTimes,
              overrides: bundle.overrides,
              slotsByDate: bundle.slotsByDate,
            },
          });
        } catch (err) {
          if (availabilityFetchIdRef.current !== myId) return;
          console.error("[booking-wizard] availability fetch failed", err);
          dispatch({ type: "SET_CALENDAR_ERROR", error: true });
        }
      });
    },
    []
  );

  // Deep-link from /cennik or /sluzby/[slug]: when the wizard mounts with
  // a pre-selected barber (single-barber service), fetch the calendar so
  // step 3 doesn't get stuck on "Načítavam rozvrh...". One-shot via ref
  // so the user can navigate back to step 1 without re-firing the fetch.
  // If SSR already provided a hydration bundle (slotsByDate is populated),
  // skip the fetch — the calendar is already usable on first paint.
  const calendarPrefetchedRef = useRef(false);
  useEffect(() => {
    if (calendarPrefetchedRef.current) return;
    if (!state.barberId || !state.serviceId) return;
    calendarPrefetchedRef.current = true;
    if (state.slotsByDate) return; // SSR-prefetched, no client fetch needed
    loadBarberAvailability(state.barberId, state.serviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't auto-scroll on the very first render of a plain home-page visit.
  // The user lands on `/`, hits the logo + announcement first, and decides
  // whether to scroll down themselves. We still auto-scroll when the wizard
  // mounts already at a later step — the deep-link path (`?service=X` from
  // /cennik or /sluzby/[slug]) — because the visitor came specifically to
  // continue booking and shouldn't have to hunt for the form.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    const isInitialRender = !hasMountedRef.current;
    hasMountedRef.current = true;
    if (isInitialRender && state.step === 1) return;

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

  // Brief ring-flash on the just-completed section after an auto-advance.
  // Without it the section silently collapses and a fast user is left
  // wondering whether the click registered. Cleared after 700ms so the
  // animation doesn't loop.
  const prevStepRef = useRef(state.step);
  const [flashStep, setFlashStep] = useState<number | null>(null);
  useEffect(() => {
    if (state.step > prevStepRef.current) {
      const prev = prevStepRef.current;
      setFlashStep(prev);
      const t = setTimeout(() => setFlashStep(null), 700);
      prevStepRef.current = state.step;
      return () => clearTimeout(t);
    }
    prevStepRef.current = state.step;
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
        loadBarberAvailability(barberId, serviceId);
      }
    },
    [barbers, loadBarberAvailability]
  );

  const handleSelectBarber = useCallback(
    (barberId: string) => {
      if (!state.serviceId) return;
      dispatch({ type: "SELECT_BARBER", barberId });
      loadBarberAvailability(barberId, state.serviceId);
    },
    [loadBarberAvailability, state.serviceId]
  );

  const handleSelectDate = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      const dateStr = format(date, "yyyy-MM-dd");
      // Slots are already in state.slotsByDate from the bulk fetch on
      // barber-select (or the SSR seed). No follow-up server call.
      dispatch({ type: "SELECT_DATE", date: dateStr });
    },
    []
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
            onClick={() => handleEdit(4)}
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
      {/* Progress is now communicated by the vertical stepper rail inside
          each SectionWrapper (numbered circles + connector lines), so the
          previous horizontal progress bar + back chevron are removed. The
          back-button affordance is retained via clicking on any completed
          section's header (its built-in Edit/pencil action). */}
      <span
        role="progressbar"
        aria-valuenow={state.step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={`Krok ${state.step} z ${TOTAL_STEPS}`}
        className="sr-only"
      >
        {STEP_LABELS[state.step]}
      </span>

      {/* 1 — Služba */}
      <SectionWrapper
        ref={setSectionRef(1)}
        stepNumber={1}
        title="Služba"
        isActive={state.step === 1}
        isCompleted={state.step > 1}
        hasNext={state.step > 1}
        isFlashing={flashStep === 1}
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
        hasNext={state.step > 2}
        isFlashing={flashStep === 2}
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

      {/* 3 — Dátum a čas (combined) */}
      {/* Calendar + slot grid live in the same section. Picking a date
          reveals the slots inline below the calendar instead of advancing
          to a separate step — earlier we had separate Dátum (3) and Čas
          (4) steps but users got stuck on the slot grid because they
          couldn't discover that the small "Štvrtok, 8. máj" summary above
          was tappable to change the day. Single section makes the day
          picker always visible. */}
      <SectionWrapper
        ref={setSectionRef(3)}
        stepNumber={3}
        title="Dátum a čas"
        isActive={state.step === 3}
        isCompleted={state.step > 3}
        hasNext={state.step > 3}
        isFlashing={flashStep === 3}
        completedSummary={
          state.date && state.time
            ? `${format(parseISO(state.date), "EEEE, d. MMMM", { locale: sk })} o ${state.time}`
            : state.date
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
              onClick={() =>
                state.barberId &&
                state.serviceId &&
                loadBarberAvailability(state.barberId, state.serviceId)
              }
              disabled={!state.barberId || !state.serviceId}
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
          <>
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
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              Sivé dni nie sú dostupné — barber má voľno alebo sú mimo rezervačného obdobia.
            </p>

            {/* Slot grid appears inline once a date is picked. Visually
                separated by a divider + small heading so it reads as a
                sub-step rather than a sibling step. */}
            {state.date && state.slotsByDate && (
              <div className="mt-5 border-t border-border/40 pt-4">
                <p className="mb-3 text-center text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Voľné termíny —{" "}
                  <span className="text-foreground">
                    {format(parseISO(state.date), "EEEE d. MMMM", {
                      locale: sk,
                    })}
                  </span>
                </p>
                <TimeSlots
                  slots={state.slotsByDate[state.date] ?? []}
                  selectedTime={state.time}
                  onSelect={handleSelectTime}
                  onChangeDate={() => {
                    // Calendar is already visible — but the user clicked
                    // "Zmeniť deň" inside the slot grid. Clear the date so
                    // the slot grid hides and the user is nudged back to
                    // pick from the calendar above.
                    dispatch({ type: "EDIT_STEP", step: 3 });
                  }}
                />
              </div>
            )}
          </>
        )}
      </SectionWrapper>

      {/* 4 — Kontaktné údaje */}
      <SectionWrapper
        ref={setSectionRef(4)}
        stepNumber={4}
        title="Kontaktné údaje"
        isActive={state.step === 4}
        isCompleted={state.step > 4}
        hasNext={state.step > 4}
        isFlashing={flashStep === 4}
        completedSummary={
          state.contact
            ? `${state.contact.firstName} ${state.contact.lastName}`
            : undefined
        }
        onEdit={() => handleEdit(4)}
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

      {/* 5 — Potvrdenie */}
      <SectionWrapper
        ref={setSectionRef(5)}
        stepNumber={5}
        title="Potvrdenie"
        isActive={state.step === 5}
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

            {/* Terms checkbox — visually emphasised AND placed directly
                above the submit button so users tie the consent gate to
                the action it gates. mt-3 (was mt-5) closes the gap. */}
            <label
              className={cn(
                "mt-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors",
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
              className="mt-3 h-12 w-full text-base font-semibold"
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
  const [expanded, setExpanded] = useState(false);

  // Description is hidden by default — it clutters the scan-flow and at
  // step 1 customers mostly need name, price, duration. The (i) button
  // tucked in the bottom-right corner reveals it on demand and is
  // intentionally outside the natural tap zone (which is the card body)
  // so a stray tap on the card still selects the service.
  const trimmed = description?.trim() ?? "";

  // Outer is a div (not <button>) so the inner info-toggle can be a real
  // button without nesting interactive elements. Keyboard a11y is
  // restored by hand.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.98] sm:p-4",
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
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
            <ClockIcon className="size-4" />
            {durationMinutes} min
          </div>
          {trimmed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
              aria-label={expanded ? "Skryť popis služby" : "Zobraziť popis služby"}
              className={cn(
                "-my-1.5 -mr-1.5 flex size-8 items-center justify-center rounded-full transition-colors active:scale-90",
                expanded
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground/60 hover:bg-muted hover:text-primary"
              )}
            >
              <InfoIcon className="size-4" />
            </button>
          )}
        </div>
        {expanded && trimmed && (
          <p className="mt-2 rounded-lg bg-background/60 p-2.5 text-[14px] leading-snug text-muted-foreground">
            {trimmed}
          </p>
        )}
      </div>

      {/* Check */}
      {isSelected && (
        <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
          <CheckCircle2Icon className="size-4 text-primary-foreground" />
        </div>
      )}
    </div>
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

      {/* Check (only when selected — unselected state stays clean to match
          the service card affordance, where the whole card is the tap area). */}
      {isSelected && (
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
          <CheckCircle2Icon className="size-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}
