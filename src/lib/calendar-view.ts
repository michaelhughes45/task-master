import { z } from "zod";
import { DAY_MINUTES, initialScrollHour, layoutDay, type DaySpan } from "@/lib/calendar-layout";
import {
  addDays,
  addWeeks,
  dayEndInstant,
  dayStartInstant,
  formatDayLong,
  formatDayShort,
  formatTime,
  formatWeekRange,
  fromDbDate,
  instantToWallMinutes,
  weekDays,
  weekStartOf,
} from "@/lib/dates";
import { toEventDetails } from "@/lib/event-details";
import type { CalendarColumn, CalendarEvent, CalendarView } from "@/types/calendar";
import type { DateStr } from "@/types/dates";
import type { EventView } from "@/types/events";

const viewParam = z.enum(["day", "week", "month"]);
const SHOW_TIME_MINUTES = 45;

// ?view= as a drawn view. Month falls back to week until spec 14; bad values to week too.
export function parseView(value: string | string[] | undefined): CalendarView {
  const parsed = viewParam.safeParse(value);
  return parsed.success && parsed.data === "day" ? "day" : "week";
}

// Without a date the page shows today, so "Today" links leave it out.
export function calendarHref(view: CalendarView, date?: DateStr) {
  return date ? `/calendar?view=${view}&date=${date}` : `/calendar?view=${view}`;
}

export function calendarDays(view: CalendarView, date: DateStr): DateStr[] {
  return view === "day" ? [date] : weekDays(weekStartOf(date));
}

// The same weekday a week back or forward in the week view, so switching to Day keeps it.
export function stepDate(view: CalendarView, date: DateStr, direction: 1 | -1): DateStr {
  return view === "day" ? addDays(date, direction) : addWeeks(date, direction);
}

// "Wednesday, October 28" or "Oct 26 – Nov 1, 2026" (cross-year weeks already carry years).
export function rangeLabel(view: CalendarView, date: DateStr) {
  if (view === "day") return formatDayLong(date);
  const monday = weekStartOf(date);
  const sunday = addDays(monday, 6);
  const range = formatWeekRange(monday);
  return monday.slice(0, 4) === sunday.slice(0, 4) ? `${range}, ${monday.slice(0, 4)}` : range;
}

// The event's part of `day` by the wall clock, clipped at midnight on either side.
function daySpan(event: EventView, day: DateStr, tz: string): DaySpan | null {
  const dayStart = dayStartInstant(day, tz);
  const dayEnd = dayEndInstant(day, tz);
  if (event.startAt >= dayEnd || event.endAt <= dayStart) return null;
  return {
    id: event.id,
    start: event.startAt <= dayStart ? 0 : instantToWallMinutes(event.startAt, tz),
    end: event.endAt >= dayEnd ? DAY_MINUTES : instantToWallMinutes(event.endAt, tz),
  };
}

// All-day events hold UTC dates: first day inclusive, end exclusive.
function coversDay(event: EventView, day: DateStr) {
  return fromDbDate(event.startAt) <= day && day < fromDbDate(event.endAt);
}

interface ColumnsInput {
  events: EventView[];
  days: DateStr[];
  today: DateStr;
  view: CalendarView;
  tz: string;
}

// Everything the time grid draws, computed on the server in the user's timezone.
export function buildCalendarColumns({ events, days, today, view, tz }: ColumnsInput) {
  const items = new Map<string, CalendarEvent>(
    events.map((event) => [
      event.id,
      { id: event.id, title: event.title, color: event.color, details: toEventDetails(event, tz) },
    ]),
  );
  const timed = events.filter((event) => !event.allDay);
  const allSpans: DaySpan[] = [];

  const columns: CalendarColumn[] = days.map((day) => {
    const spans = timed.flatMap((event) => daySpan(event, day, tz) ?? []);
    allSpans.push(...spans);
    const spanById = new Map(spans.map((span) => [span.id, span]));
    return {
      day,
      heading: view === "day" ? formatDayLong(day).split(",")[0] : formatDayShort(day).split(",")[0],
      dayNumber: Number(day.slice(8)),
      isToday: day === today,
      allDay: events.filter((event) => event.allDay && coversDay(event, day)).map((event) => items.get(event.id)!),
      timed: layoutDay(spans).map((layout) => {
        const event = timed.find(({ id }) => id === layout.id)!;
        const span = spanById.get(layout.id)!;
        return {
          ...items.get(layout.id)!,
          layout,
          timeLabel: `${formatTime(event.startAt, tz)} – ${formatTime(event.endAt, tz)}`,
          showTime: span.end - span.start >= SHOW_TIME_MINUTES,
        };
      }),
    };
  });

  return { columns, scrollHour: initialScrollHour(allSpans) };
}
