import type { EventColor } from "@/generated/prisma/enums";
import type { DateStr, WallTime } from "@/types/dates";

export type { EventColor };

// One event occurrence as pages see it. Timed events hold UTC instants; all-day events hold
// their first day and the day after their last day at 00:00 UTC, so read those with fromDbDate.
// A repeating event appears once per occurrence with the same `id`; `key` tells them apart.
export interface EventView {
  id: string;
  key: string;
  // The start the series produced (the same as startAt unless the occurrence was moved).
  occurrenceStart: Date;
  title: string;
  notes: string | null;
  location: string | null;
  color: EventColor;
  allDay: boolean;
  startAt: Date;
  endAt: Date;
  // The stored series a repeating event's occurrence came from; null for a one-off event.
  series: { rrule: string } | null;
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
  rrule: string | null;
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
  // "Weekly on Mon, Wed, Fri"; null for a one-off event.
  repeatLabel: string | null;
  // A repeating event's occurrence, by its original start (ISO), which edits and deletes name
  // with a scope (this, following, all); null for a one-off event.
  occurrenceStart: string | null;
  // The occurrence as shown, plus the series' repeat rule.
  form: EventFormValues;
}
