"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Barber color palette — vivid, high contrast
const BARBER_COLORS = [
  { bg: "#3b82f6", border: "#1d4ed8" }, // blue
  { bg: "#10b981", border: "#047857" }, // green
  { bg: "#f59e0b", border: "#b45309" }, // amber
  { bg: "#8b5cf6", border: "#6d28d9" }, // purple
  { bg: "#ec4899", border: "#be185d" }, // pink
  { bg: "#06b6d4", border: "#0e7490" }, // cyan
];

// Status modifies the barber color — each status has distinct visual treatment
// Barber color = hue, Status = visual modifier (opacity, border, pattern)
const STATUS_CSS: Record<string, string> = {
  PENDING:
    `opacity: 0.7;
     border-width: 2px !important;
     border-style: dashed !important;
     background-image: repeating-linear-gradient(
       45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px
     ) !important;`,
  CONFIRMED:
    `opacity: 1;
     border-width: 2px !important;
     border-style: solid !important;`,
  IN_PROGRESS:
    `opacity: 1;
     border-width: 3px !important;
     border-style: solid !important;
     box-shadow: 0 0 0 1px rgba(255,255,255,0.5), 0 0 8px rgba(0,0,0,0.3) !important;
     animation: cal-pulse 2s ease-in-out infinite !important;`,
  COMPLETED:
    `opacity: 0.45;
     border-width: 2px !important;
     border-style: solid !important;
     background-image: repeating-linear-gradient(
       -45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 5px
     ) !important;`,
  CANCELLED:
    `opacity: 0.35;
     border-width: 2px !important;
     border-style: dotted !important;
     text-decoration: line-through !important;
     filter: grayscale(60%) !important;`,
  NO_SHOW:
    `opacity: 0.35;
     border-width: 2px !important;
     border-style: double !important;
     text-decoration: line-through !important;
     filter: grayscale(40%) saturate(1.5) !important;`,
};

interface BarberInfo {
  id: string;
  name: string;
  colorIndex: number;
}

export function AdminCalendar() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [barbers, setBarbers] = useState<BarberInfo[]>([]);
  const barberMapRef = useRef<Map<string, number>>(new Map());
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);

    updateViewport();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateViewport);
      return () => mediaQuery.removeEventListener("change", updateViewport);
    }

    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  const getBarberColor = (barberId: string, barberName: string) => {
    const map = barberMapRef.current;
    if (!map.has(barberId)) {
      const index = map.size % BARBER_COLORS.length;
      map.set(barberId, index);
      setBarbers((prev) => {
        if (prev.some((b) => b.id === barberId)) return prev;
        return [...prev, { id: barberId, name: barberName, colorIndex: index }];
      });
    }
    return BARBER_COLORS[map.get(barberId)!];
  };

  const fetchEvents = useCallback(
    async (
      fetchInfo: { startStr: string; endStr: string },
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: fetchInfo.startStr,
          end: fetchInfo.endStr,
        });
        const res = await fetch(`/api/admin/calendar?${params}`);
        const data = await res.json();

        const events: EventInput[] = data.map(
          (evt: {
            id: string;
            title: string;
            start: string;
            end: string;
            extendedProps: { barberId: string; barberName: string; status: string };
          }) => {
            const color = getBarberColor(
              evt.extendedProps.barberId,
              evt.extendedProps.barberName
            );
            const status = evt.extendedProps.status;

            return {
              id: evt.id,
              title: evt.title,
              start: evt.start,
              end: evt.end,
              backgroundColor: color.bg,
              borderColor: color.border,
              textColor: "#fff",
              extendedProps: evt.extendedProps,
              classNames: [`cal-status-${status.toLowerCase()}`],
            };
          }
        );

        successCallback(events);
      } catch (err) {
        toast.error("Nepodarilo sa načítať kalendár");
        failureCallback(err as Error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleEventClick = (info: EventClickArg) => {
    router.push(`/admin/reservations/${info.event.id}`);
  };

  // Build CSS from STATUS_CSS map
  const statusStyles = Object.entries(STATUS_CSS)
    .map(([key, css]) => `.cal-status-${key.toLowerCase()} { ${css} }`)
    .join("\n");

  return (
    <div>
      {/* Legend */}
      <div className="mb-4 space-y-3">
        {barbers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium text-muted-foreground">Barberi:</span>
            {barbers.map((b) => (
              <div key={b.id} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-3 rounded-full shadow-sm"
                  style={{ backgroundColor: BARBER_COLORS[b.colorIndex].bg }}
                />
                <span className="text-xs sm:text-sm">{b.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-sm font-medium text-muted-foreground">Stav:</span>
          {/* Pending */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border-2 border-dashed border-blue-400 bg-blue-400/70"
              style={{
                backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.2) 2px, rgba(255,255,255,0.2) 4px)",
              }}
            />
            <span className="text-xs">Čakajúca</span>
          </div>
          {/* Confirmed */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border-2 border-solid border-blue-600 bg-blue-500" />
            <span className="text-xs">Potvrdená</span>
          </div>
          {/* In Progress */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border-[3px] border-solid border-blue-600 bg-blue-500 shadow-md" />
            <span className="text-xs">Prebieha</span>
          </div>
          {/* Completed */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border-2 border-solid border-blue-600 bg-blue-500 opacity-45"
              style={{
                backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.25) 3px, rgba(255,255,255,0.25) 4px)",
              }}
            />
            <span className="text-xs">Dokončená</span>
          </div>
          {/* Cancelled */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border-2 border-dotted border-gray-400 bg-gray-400/40 line-through opacity-50" />
            <span className="text-xs">Zrušená</span>
          </div>
          {/* No Show */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border-[3px] border-double border-red-400 bg-red-400/40 line-through opacity-50" />
            <span className="text-xs">Neprišiel</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cal-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(255,255,255,0.5), 0 0 8px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 2px rgba(255,255,255,0.7), 0 0 12px rgba(0,0,0,0.4); }
        }
        .fc .fc-toolbar {
          gap: 0.75rem;
        }
        .fc .fc-toolbar.fc-header-toolbar,
        .fc .fc-toolbar.fc-footer-toolbar {
          flex-wrap: wrap;
          align-items: center;
        }
        .fc .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
        }
        .fc .fc-button {
          border-radius: 0.75rem;
          padding: 0.45rem 0.75rem;
          box-shadow: none !important;
        }
        .fc .fc-timegrid-slot-label-cushion,
        .fc .fc-col-header-cell-cushion {
          padding-inline: 0.35rem;
        }
        .fc .fc-event-main {
          padding: 0.125rem 0.25rem;
        }
        @media (max-width: 767px) {
          .fc .fc-toolbar-title {
            font-size: 0.95rem;
          }
          .fc .fc-button {
            padding: 0.35rem 0.55rem;
            font-size: 0.8rem;
          }
          .fc .fc-timegrid-axis-cushion,
          .fc .fc-timegrid-slot-label-cushion,
          .fc .fc-col-header-cell-cushion {
            font-size: 0.75rem;
          }
          .fc .fc-event {
            font-size: 0.75rem;
          }
        }
        ${statusStyles}
      `}</style>

      <div className="relative overflow-hidden rounded-xl border bg-card p-2 sm:p-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <FullCalendar
          key={isMobile ? "mobile" : "desktop"}
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
          headerToolbar={
            isMobile
              ? {
                  left: "prev,next",
                  center: "title",
                  right: "today",
                }
              : {
                  left: "prev,next today",
                  center: "title",
                  right: "timeGridDay,timeGridWeek",
                }
          }
          footerToolbar={
            isMobile
              ? {
                  center: "timeGridDay,timeGridWeek",
                }
              : undefined
          }
          locale="sk"
          firstDay={1}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          height="auto"
          events={fetchEvents}
          eventClick={handleEventClick}
          nowIndicator
          slotDuration="00:15:00"
          eventMinHeight={28}
          stickyHeaderDates
          dayHeaderFormat={
            isMobile
              ? { weekday: "short", day: "numeric", month: "numeric" }
              : undefined
          }
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
        />
      </div>
    </div>
  );
}
