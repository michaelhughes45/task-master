import { z } from "zod";
import { DAY_MINUTES, initialScrollHour, layoutDay, type DaySpan } from "@/lib/calendar-layout";
import {
  addDays,
  addMonths,
  addWeeks,
  dayEndInstant,
  dayStartInstant,
  formatDayLong,
  formatDayShort,
  formatMonth,
  formatTime,
  formatWeekRange,
  fromDbDate,
  instantToWallMinutes,
  monthGridRange,
  weekDays,
  weekStartOf,
} from "@/lib/dates";
import { toEventDetails } from "@/lib/event-details";
import type { CalendarColumn, CalendarEvent, CalendarView, MonthDay } from "@/types/calendar";
import type { DateStr } from "@/types/dates";
import type { EventView } from "@/types/events";

const viewParam = z.enum(["day", "week", "month"]);
const SHOW_TIME_MINUTES = 45;
const MONTH_CHIPS = 2;

// ?view= as a drawn view. Bad or missing values fall back to week.
export function parseView(value: string | string[] | undefined): CalendarView {
  const parsed = viewParam.safeParse(value);
  return parsed.success ? parsed.data : "week";
}

// Without a date the page shows today, so "Today" links leave it out.
export function calendarHref(view: CalendarView, date?: DateStr) {
  return date ? `/calendar?view=${view}&date=${date}` : `/calendar?view=${view}`;
}

export function calendarDays(view: CalendarView, date: DateStr): DateStr[] {
  if (view === "day") return [date];
  if (view === "week") return weekDays(weekStartOf(date));
  const { start, end } = monthGridRange(date);
  const days: DateStr[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

// The same weekday a week back or forward in the week view, and the same day of the month
// (clamped) in the month view, so switching to Day keeps it.
export function stepDate(view: CalendarView, date: DateStr, direction: 1 | -1): DateStr {
  if (view === "day") return addDays(date, direction);
  return view === "week" ? addWeeks(date, direction) : addMonths(date, direction);
}

// "Wednesday, October 28", "Oct 26 – Nov 1, 2026" (cross-year weeks already carry years)
// or "October 2026".
export function rangeLabel(view: CalendarView, date: DateStr) {
  if (view === "day") return formatDayLong(date);
  if (view === "month") return formatMonth(date);
  const monday = weekStartOf(date);
  const sunday = addDays(monday, 6);
  const range = formatWeekRange(monday);
  return monday.slice(0, 4) === sunday.slice(0, 4) ? `${range}, ${monday.slice(0, 4)}` : range;
}

// The event's part of `day` by the wall clock, clipped at midnight on either side.
function daySpan(event: EventView, day: DateStr, tz: string): DaySpan | null {
  const dayStart = dayStartInstant(day, tz);
  const dayEnd = dayEndInstant(day, tz);
  if (!touchesDay(event, day, tz)) return null;
  return {
    id: event.id,
    start: event.startAt <= dayStart ? 0 : instantToWallMinutes(event.startAt, tz),
    end: event.endAt >= dayEnd ? DAY_MINUTES : instantToWallMinutes(event.endAt, tz),
  };
}

// Timed events touch a day if any part falls inside it in the zone.
function touchesDay(event: EventView, day: DateStr, tz: string) {
  return event.startAt < dayEndInstant(day, tz) && event.endAt > dayStartInstant(day, tz);
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
  const items = new Map(events.map((event) => [event.id, calendarEvent(event, tz)]));
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

function calendarEvent(event: EventView, tz: string): CalendarEvent {
  return { id: event.id, title: event.title, color: event.color, details: toEventDetails(event, tz) };
}

interface MonthInput {
  events: EventView[];
  // The month being shown; any day in it.
  date: DateStr;
  today: DateStr;
  tz: string;
}

// The month grid's cells. `events` arrive all-day first, then by start, so each day keeps that
// order. Multi-day events show on every day they cover.
export function buildMonthDays({ events, date, today, tz }: MonthInput): MonthDay[] {
  const month = date.slice(0, 7);
  const items = new Map(events.map((event) => [event.id, calendarEvent(event, tz)]));

  return calendarDays("month", date).map((day) => {
    const dayEvents = events.filter((event) =>
      event.allDay ? coversDay(event, day) : touchesDay(event, day, tz),
    );
    return {
      day,
      dayNumber: Number(day.slice(8)),
      label: formatDayLong(day),
      inMonth: day.slice(0, 7) === month,
      isToday: day === today,
      chips: dayEvents.slice(0, MONTH_CHIPS).map((event) => items.get(event.id)!),
      moreCount: Math.max(0, dayEvents.length - MONTH_CHIPS),
    };
  });
}
