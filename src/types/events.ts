import type { EventColor } from "@/generated/prisma/enums";
import type { DateStr, WallTime } from "@/types/dates";

export type { EventColor };

// One event as pages see it. Timed events hold UTC instants; all-day events hold their first
// day and the day after their last day at 00:00 UTC, so read those with fromDbDate.
export interface EventView {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  color: EventColor;
  allDay: boolean;
  startAt: Date;
  endAt: Date;
}

// The event form's fields, as strings the inputs hold. Times are "HH:mm" in the user's zone.
export interface EventFormValues {
  title: string;
  date: DateStr;
  allDay: boolean;
  startTime: WallTime;
  endTime: WallTime;
  location: string;
  notes: string;
  color: EventColor;
}

// One event ready for the details dialog: labels formatted on the server in the user's zone,
// plus the values the Edit form starts with.
export interface EventDetails {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  color: EventColor;
  dayLabel: string;
  timeLabel: string;
  form: EventFormValues;
}
