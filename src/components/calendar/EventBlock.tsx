"use client";

import { useItemDialogs } from "@/hooks/use-item-dialogs";
import { cn } from "@/lib/utils";
import type { CalendarEvent, PositionedEvent } from "@/types/calendar";
import type { EventColor } from "@/types/events";

const COLOR_CLASS: Record<EventColor, string> = {
  BLUE: "bg-primary-soft text-primary-ink",
  GREEN: "bg-success-soft text-success-ink",
};

const BASE_CLASS =
  "overflow-hidden rounded-[6px] text-left text-[12.5px] leading-[1.35] outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function eventLabel({ title, details }: CalendarEvent) {
  return `${title}, ${details.dayLabel}, ${details.timeLabel}`;
}

// A timed event in its day column. Opens the details dialog.
export function EventBlock({ event }: { event: PositionedEvent }) {
  const { openEvent } = useItemDialogs();
  const { top, height, left, width } = event.layout;

  return (
    <button
      type="button"
      onClick={() => openEvent(event.details)}
      aria-label={eventLabel(event)}
      className={cn(
        BASE_CLASS,
        "absolute z-[1] flex flex-col justify-start px-2 py-0.5 ring-1 ring-card",
        COLOR_CLASS[event.color],
      )}
      // Computed from the event's times, so it can't be a static class. 1px gaps between
      // stacked events, 2px between side-by-side ones.
      style={{
        top: top + 1,
        height: height - 2,
        left: `calc(${left}% + 2px)`,
        width: `calc(${width}% - 4px)`,
      }}
    >
      <span className="block truncate font-semibold">{event.title}</span>
      {event.showTime && <span className="block truncate font-mono text-[11.5px]">{event.timeLabel}</span>}
    </button>
  );
}

// An all-day event in the row above the grid.
export function AllDayEvent({ event }: { event: CalendarEvent }) {
  const { openEvent } = useItemDialogs();

  return (
    <button
      type="button"
      onClick={() => openEvent(event.details)}
      aria-label={eventLabel(event)}
      className={cn(BASE_CLASS, "block w-full truncate px-2 py-0.5 font-semibold", COLOR_CLASS[event.color])}
    >
      {event.title}
    </button>
  );
}
