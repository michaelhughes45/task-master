import type { EventLayout } from "@/lib/calendar-layout";
import type { DateStr } from "@/types/dates";
import type { EventColor, EventDetails } from "@/types/events";

export type CalendarView = "day" | "week" | "month";

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

// One cell of the month grid.
export interface MonthDay {
  day: DateStr;
  dayNumber: number;
  // "Wednesday, October 28", for the cell's links.
  label: string;
  inMonth: boolean;
  isToday: boolean;
  // The first few events, all-day first, then by start time.
  chips: CalendarEvent[];
  // How many more events the day has than chips.
  moreCount: number;
}
