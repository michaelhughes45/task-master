import type { EventLayout } from "@/lib/calendar-layout";
import type { DateStr } from "@/types/dates";
import type { EventColor, EventDetails } from "@/types/events";

// The views the calendar draws. "month" arrives in spec 14.
export type CalendarView = "day" | "week";

export interface CalendarEvent {
  id: string;
  title: string;
  color: EventColor;
  // For the details dialog, formatted on the server.
  details: EventDetails;
}

// A timed event's part of one day, positioned in that day's column.
export interface PositionedEvent extends CalendarEvent {
  layout: EventLayout;
  timeLabel: string;
  // Hidden on blocks shorter than 45 minutes.
  showTime: boolean;
}

export interface CalendarColumn {
  day: DateStr;
  // "Mon" in the week view, "Wednesday" in the day view.
  heading: string;
  dayNumber: number;
  isToday: boolean;
  allDay: CalendarEvent[];
  timed: PositionedEvent[];
}
