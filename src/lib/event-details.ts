import {
  addDays,
  formatDayLong,
  formatDayShort,
  formatMinutes,
  formatTime,
  fromDbDate,
  instantToWallTime,
  todayIn,
} from "@/lib/dates";
import { describeRRule } from "@/lib/rrule-builder";
import type { EventDetails, EventView } from "@/types/events";

// Times the Edit form offers if an all-day event is switched to a timed one.
const ALL_DAY_FORM_TIMES = { startTime: "09:00", endTime: "10:00" };
const MINUTE_MS = 60 * 1000;

function allDayLabels(event: EventView) {
  const first = fromDbDate(event.startAt);
  const last = addDays(fromDbDate(event.endAt), -1);
  const dayLabel = last > first ? `${formatDayLong(first)} – ${formatDayLong(last)}` : formatDayLong(first);
  return { date: first, dayLabel, timeLabel: "All day", ...ALL_DAY_FORM_TIMES };
}

// Duration is the real time between the instants, so a DST change inside the event counts.
function timedLabels(event: EventView, tz: string) {
  const date = todayIn(tz, event.startAt);
  const endDay = todayIn(tz, event.endAt);
  const minutes = Math.round((event.endAt.getTime() - event.startAt.getTime()) / MINUTE_MS);
  const end =
    endDay === date ? formatTime(event.endAt, tz) : `${formatDayShort(endDay)}, ${formatTime(event.endAt, tz)}`;
  return {
    date,
    dayLabel: formatDayLong(date),
    timeLabel: `${formatTime(event.startAt, tz)} – ${end} (${formatMinutes(minutes)})`,
    startTime: instantToWallTime(event.startAt, tz),
    endTime: instantToWallTime(event.endAt, tz),
  };
}

function labels(event: EventView, tz: string) {
  return event.allDay ? allDayLabels(event) : timedLabels(event, tz);
}

// Call on the server: labels and form times are in the user's zone, never the browser's. The
// labels describe the occurrence; a repeating event's form starts from its series.
export function toEventDetails(event: EventView, tz: string): EventDetails {
  const { date, dayLabel, timeLabel } = labels(event, tz);
  const { series } = event;
  const form = series ? labels({ ...event, startAt: series.startAt, endAt: series.endAt }, tz) : labels(event, tz);
  return {
    id: event.id,
    title: event.title,
    notes: event.notes,
    location: event.location,
    color: event.color,
    dayLabel,
    timeLabel,
    repeatLabel: series && describeRRule(series.rrule, date),
    form: {
      title: event.title,
      date: form.date,
      allDay: event.allDay,
      startTime: form.startTime,
      endTime: form.endTime,
      location: event.location ?? "",
      notes: event.notes ?? "",
      color: event.color,
      rrule: series?.rrule ?? null,
    },
  };
}
