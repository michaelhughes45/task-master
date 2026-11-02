import type { CalendarEvent } from "@/types/calendar";

// Shared by the calendar's event buttons: block, all-day bar and month chip.

export const EVENT_BUTTON_CLASS =
  "overflow-hidden rounded-[6px] text-left text-[12.5px] leading-[1.35] outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function eventLabel({ title, details }: CalendarEvent) {
  return `${title}, ${details.dayLabel}, ${details.timeLabel}`;
}
