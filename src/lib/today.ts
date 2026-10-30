import { formatDayShort, formatMinutes, formatTime, todayIn } from "@/lib/dates";
import { toEventDetails } from "@/lib/event-details";
import type { DateStr } from "@/types/dates";
import type { EventColor, EventDetails, EventView } from "@/types/events";
import type { TaskView } from "@/types/tasks";

const MINUTE_MS = 60 * 1000;

// One event on the Today page's schedule, with its labels formatted on the server.
export interface ScheduleItem {
  key: string;
  title: string;
  color: EventColor;
  allDay: boolean;
  // "9:00 AM", or "Tue 11:00 PM" when it started on an earlier day; "All day".
  startLabel: string;
  // null for all-day events.
  endLabel: string | null;
  // Instants as milliseconds, so the client can tell past, now and upcoming apart. null for
  // all-day events, which are never past or now.
  startMs: number | null;
  endMs: number | null;
  // "3h · Library · Every weekday"
  meta: string;
  details: EventDetails;
}

export type EventTiming = "past" | "now" | "upcoming";

// The time, with the weekday in front when the instant falls on another day than `today`.
function timeOn(instant: Date, today: DateStr, tz: string) {
  const day = todayIn(tz, instant);
  const time = formatTime(instant, tz);
  return day === today ? time : `${formatDayShort(day).split(",")[0]} ${time}`;
}

// Call on the server: every label is in the user's zone. Keeps the query's order (all-day
// first, then by start).
export function buildSchedule(events: EventView[], today: DateStr, tz: string): ScheduleItem[] {
  return events.map((event) => {
    const details = toEventDetails(event, tz);
    const duration = event.allDay
      ? null
      : formatMinutes(Math.round((event.endAt.getTime() - event.startAt.getTime()) / MINUTE_MS));
    return {
      key: event.key,
      title: event.title,
      color: event.color,
      allDay: event.allDay,
      startLabel: event.allDay ? "All day" : timeOn(event.startAt, today, tz),
      endLabel: event.allDay ? null : timeOn(event.endAt, today, tz),
      startMs: event.allDay ? null : event.startAt.getTime(),
      endMs: event.allDay ? null : event.endAt.getTime(),
      meta: [duration, event.location, details.repeatLabel].filter(Boolean).join(" · "),
      details,
    };
  });
}

export function eventTiming(item: Pick<ScheduleItem, "startMs" | "endMs">, now: number): EventTiming {
  if (item.startMs === null || item.endMs === null) return "upcoming";
  if (item.endMs <= now) return "past";
  return item.startMs <= now ? "now" : "upcoming";
}

// The first timed event on now, and the first one that starts after now.
export function nowAndNext(items: ScheduleItem[], now: number) {
  return {
    current: items.find((item) => eventTiming(item, now) === "now"),
    next: items.find((item) => item.startMs !== null && item.startMs > now),
  };
}

// "Mon", "Mon and Tue", "Mon, Tue and Wed"
export function formatList(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Earlier tasks still not done: how many, and the days they're on (in order).
export function missedSummary(tasks: TaskView[]) {
  const missed = tasks.filter((task) => !task.done);
  const days = [...new Set(missed.map((task) => task.day))].sort();
  return {
    count: missed.length,
    firstDay: days[0] ?? null,
    dayNames: formatList(days.map((day) => formatDayShort(day).split(",")[0])),
  };
}
