import type { EventColor } from "@/generated/prisma/enums";

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
