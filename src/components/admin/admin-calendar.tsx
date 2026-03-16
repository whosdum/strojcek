"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";

export function AdminCalendar() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  const fetchEvents = useCallback(
    async (
      fetchInfo: { startStr: string; endStr: string },
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void
    ) => {
      try {
        const res = await fetch(
          `/api/admin/calendar?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`
        );
        const events = await res.json();
        successCallback(events);
      } catch (err) {
        failureCallback(err as Error);
      }
    },
    []
  );

  const handleEventClick = (info: EventClickArg) => {
    router.push(`/admin/reservations/${info.event.id}`);
  };

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "timeGridDay,timeGridWeek",
      }}
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
      eventTimeFormat={{
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }}
    />
  );
}
