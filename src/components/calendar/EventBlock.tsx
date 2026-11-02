"use client";

import { EVENT_BUTTON_CLASS, eventLabel } from "@/components/calendar/event-button";
import { useItemDialogs } from "@/hooks/use-item-dialogs";
import { EVENT_SOFT_CLASS } from "@/lib/event-colors";
import { cn } from "@/lib/utils";
import type { PositionedEvent } from "@/types/calendar";

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
        EVENT_BUTTON_CLASS,
        "absolute z-[1] flex flex-col justify-start px-2 py-0.5 ring-1 ring-card",
        EVENT_SOFT_CLASS[event.color],
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
      {event.showTime && (
        // One clipped line that wraps: when the end time doesn't fit it drops to the hidden
        // second line, leaving just the start instead of "9:00 AM – …".
        <span className="flex h-[1lh] flex-wrap overflow-hidden font-mono text-[11.5px]">
          <span className="max-w-full truncate">{event.startLabel}</span>
          <span className="whitespace-pre"> – {event.endLabel}</span>
        </span>
      )}
    </button>
  );
}
