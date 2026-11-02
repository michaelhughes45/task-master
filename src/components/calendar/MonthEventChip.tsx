"use client";

import { EVENT_BUTTON_CLASS, eventLabel } from "@/components/calendar/event-button";
import { useItemDialogs } from "@/hooks/use-item-dialogs";
import { EVENT_SOLID_CLASS } from "@/lib/event-colors";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";

// A coloured dot and the title in a month cell.
export function MonthEventChip({ event }: { event: CalendarEvent }) {
  const { openEvent } = useItemDialogs();

  return (
    <button
      type="button"
      onClick={() => openEvent(event.details)}
      aria-label={eventLabel(event)}
      className={cn(EVENT_BUTTON_CLASS, "-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 px-1 text-xs hover:bg-muted")}
    >
      <span aria-hidden="true" className={cn("size-1.5 flex-none rounded-full", EVENT_SOLID_CLASS[event.color])} />
      <span className="truncate">{event.title}</span>
    </button>
  );
}
