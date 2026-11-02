"use client";

import { EVENT_BUTTON_CLASS, eventLabel } from "@/components/calendar/event-button";
import { useItemDialogs } from "@/hooks/use-item-dialogs";
import { EVENT_SOFT_CLASS } from "@/lib/event-colors";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";

// An all-day event in the row above the grid.
export function AllDayEvent({ event }: { event: CalendarEvent }) {
  const { openEvent } = useItemDialogs();

  return (
    <button
      type="button"
      onClick={() => openEvent(event.details)}
      aria-label={eventLabel(event)}
      className={cn(EVENT_BUTTON_CLASS, "block w-full truncate px-2 py-0.5 font-semibold", EVENT_SOFT_CLASS[event.color])}
    >
      {event.title}
    </button>
  );
}
