import { Frequency, RRule } from "rrule";
import {
  addDays,
  dayEndInstant,
  dayStartInstant,
  fromDbDate,
  instantToWallTime,
  toDbDate,
  todayIn,
  wallTimeToInstant,
  weekStartOf,
} from "@/lib/dates";
import type { DateStr, TaskScope } from "@/types/dates";

// Repeating items are stored once with an RFC 5545 RRULE part ("FREQ=WEEKLY;BYDAY=MO,WE") and
// expanded here, for a bounded range only. Pure: no Prisma, no clock.
//
// Rules run on "floating" times: the item's wall time in the user's zone, written as if it were
// UTC. rrule steps through those, and each result is turned back into a real instant in the
// zone, so a 9:00 AM event stays at 9:00 AM across daylight saving changes.

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// Sub-daily rules aren't offered and could take millions of steps to reach a range.
const SUPPORTED = new Set([Frequency.YEARLY, Frequency.MONTHLY, Frequency.WEEKLY, Frequency.DAILY]);
const DATE_ONLY_UNTIL = /(^|;)UNTIL=\d{8}(;|$)/i;

// The rule with this start, or null for a rule that can't be read (shown as not repeating).
// Rules that can never match (Feb 30) make rrule step to year 9999 on every expansion, even in
// a bounded window, so rules must be validated where they're written.
function buildRule(rrule: string, dtstart: Date): RRule | null {
  try {
    const options = RRule.parseString(rrule);
    if (options.freq === undefined || !SUPPORTED.has(options.freq)) return null;
    // A date-only UNTIL includes that whole day; rrule reads it as 00:00, which would drop a
    // 9:00 AM occurrence on the last day.
    if (options.until && DATE_ONLY_UNTIL.test(rrule)) {
      options.until = new Date(options.until.getTime() + DAY_MS - 1);
    }
    return new RRule({ ...options, dtstart, tzid: null });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Tasks: expanded by date only. Weekly tasks repeat by week and always land on a Monday.

export interface TaskSeries {
  scope: TaskScope;
  // DAILY: the first day; WEEKLY: the first week's Monday.
  date: DateStr;
  rrule: string | null;
  title: string;
}

export interface TaskExceptionInput {
  occurrenceDate: DateStr;
  cancelled: boolean;
  title: string | null;
  date: DateStr | null;
}

export interface TaskOccurrence {
  // The date the rule produced. Completions and exceptions are keyed by it, even when moved.
  occurrenceDate: DateStr;
  // The date it's shown on (moved, or the same).
  date: DateStr;
  title: string;
}

function inDays(day: DateStr, first: DateStr, last: DateStr) {
  return first <= day && day <= last;
}

// Dates the series produces from `first` to `last` (inclusive), before exceptions. Weekly
// tasks take Mondays, so `first` should be one.
function taskDates(task: TaskSeries, first: DateStr, last: DateStr): DateStr[] {
  const rule = task.rrule ? buildRule(task.rrule, toDbDate(task.date)) : null;
  if (!rule) return inDays(task.date, first, last) ? [task.date] : [];
  if (task.scope === "DAILY") {
    return rule.between(toDbDate(first), toDbDate(last), true).map(fromDbDate);
  }
  return weekStarts(rule, last).filter((monday) => inDays(monday, first, last));
}

// Mondays of the weeks a weekly task's rule lands in, up to `last`. A rule with BYDAY can land
// on several days of a week; the occurrence is the week, so COUNT counts weeks, not days.
function weekStarts(rule: RRule, last: DateStr): DateStr[] {
  const { count } = rule.options;
  const days = new RRule({ ...rule.origOptions, count: null });
  const weeks: DateStr[] = [];
  days.all((date) => {
    const monday = weekStartOf(fromDbDate(date));
    if (monday > last) return false;
    if (weeks.at(-1) !== monday) {
      if (count !== null && weeks.length === count) return false;
      weeks.push(monday);
    }
    return true;
  });
  return weeks;
}

function taskDay(scope: TaskScope, day: DateStr) {
  return scope === "WEEKLY" ? weekStartOf(day) : day;
}

// Dates the series produced before `occurrenceDate`, oldest first, cancelled ones included.
export function taskDatesBefore(task: TaskSeries, occurrenceDate: DateStr): DateStr[] {
  return taskDates(task, taskDay(task.scope, task.date), addDays(occurrenceDate, -1));
}

// Whether `occurrenceDate` (a Monday for weekly tasks) is a real, not cancelled, occurrence.
export function isTaskOccurrence(task: TaskSeries, exceptions: TaskExceptionInput[], occurrenceDate: DateStr) {
  const cancelled = exceptions.some((e) => e.occurrenceDate === occurrenceDate && e.cancelled);
  return !cancelled && taskDates(task, occurrenceDate, occurrenceDate).length > 0;
}

// Occurrences shown from firstDay to lastDay (inclusive), by date. Weekly tasks count by their
// Monday, so any day of a week finds that week's occurrence. A one-off task is its own only
// occurrence.
export function expandTask<T extends TaskSeries>(
  task: T,
  exceptions: TaskExceptionInput[],
  firstDay: DateStr,
  lastDay: DateStr,
): Array<Omit<T, keyof TaskOccurrence> & TaskOccurrence> {
  const first = taskDay(task.scope, firstDay);
  const byDate = new Map(exceptions.map((e) => [e.occurrenceDate, e]));
  const originals = new Set(taskDates(task, first, lastDay));
  // Occurrences moved into the range from outside it.
  for (const e of exceptions) {
    if (e.cancelled || !e.date || originals.has(e.occurrenceDate)) continue;
    if (!inDays(taskDay(task.scope, e.date), first, lastDay)) continue;
    if (isTaskOccurrence(task, [], e.occurrenceDate)) originals.add(e.occurrenceDate);
  }

  return [...originals]
    .flatMap((occurrenceDate) => {
      const exception = byDate.get(occurrenceDate);
      if (exception?.cancelled) return [];
      const date = taskDay(task.scope, exception?.date ?? occurrenceDate);
      if (!inDays(date, first, lastDay)) return [];
      return [{ ...task, occurrenceDate, date, title: exception?.title ?? task.title }];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.occurrenceDate.localeCompare(b.occurrenceDate));
}

// ---------------------------------------------------------------------------------------------
// Events: timed events repeat on their wall time in the user's zone; all-day events on their
// UTC dates. Each occurrence keeps the series' exact duration (RFC 5545).

export interface EventSeries {
  allDay: boolean;
  startAt: Date;
  endAt: Date;
  rrule: string | null;
  title: string;
  notes: string | null;
  location: string | null;
}

export interface EventExceptionInput {
  occurrenceStart: Date;
  cancelled: boolean;
  title: string | null;
  startAt: Date | null;
  endAt: Date | null;
  notes: string | null;
  location: string | null;
}

export interface EventOccurrence {
  // The start the rule produced. Exceptions are keyed by it, even when moved.
  occurrenceStart: Date;
  startAt: Date;
  endAt: Date;
  title: string;
  notes: string | null;
  location: string | null;
}

// Converts between real instants and floating times. All-day events already hold their
// dates at 00:00 UTC, which is their floating time.
function eventClock(allDay: boolean, tz: string) {
  if (allDay) return { toFloating: (instant: Date) => instant, toInstant: (floating: Date) => floating };
  return {
    toFloating: (instant: Date) => {
      const [hours, minutes] = instantToWallTime(instant, tz).split(":").map(Number);
      return new Date(toDbDate(todayIn(tz, instant)).getTime() + (hours * 60 + minutes) * MINUTE_MS);
    },
    toInstant: (floating: Date) => {
      const iso = floating.toISOString();
      return wallTimeToInstant(iso.slice(0, 10), iso.slice(11, 16), tz);
    },
  };
}

// [start, end) of the days as instants: the zone's day bounds, or UTC dates for all-day events.
function rangeBounds(allDay: boolean, firstDay: DateStr, lastDay: DateStr, tz: string) {
  if (allDay) return { start: toDbDate(firstDay), end: toDbDate(addDays(lastDay, 1)) };
  return { start: dayStartInstant(firstDay, tz), end: dayEndInstant(lastDay, tz) };
}

// Original starts of occurrences that could overlap [start, end), before exceptions. Padded a
// day either side, since floating and real times differ by the zone's offset.
function eventStarts(event: EventSeries, start: Date, end: Date, tz: string): Date[] {
  const clock = eventClock(event.allDay, tz);
  const dtstart = clock.toFloating(event.startAt);
  const rule = event.rrule ? buildRule(event.rrule, dtstart) : null;
  if (!rule) return [event.startAt];

  const duration = event.endAt.getTime() - event.startAt.getTime();
  const from = new Date(clock.toFloating(start).getTime() - duration - DAY_MS);
  const to = new Date(clock.toFloating(end).getTime() + DAY_MS);
  // The first occurrence is the stored start, even in a repeated (fall back) hour, where the
  // wall time alone would pick the earlier of the two.
  return rule
    .between(from, to, true)
    .map((floating) => (floating.getTime() === dtstart.getTime() ? event.startAt : clock.toInstant(floating)));
}

function isEventOccurrence(event: EventSeries, occurrenceStart: Date, tz: string) {
  const starts = eventStarts(event, occurrenceStart, occurrenceStart, tz);
  return starts.some((start) => start.getTime() === occurrenceStart.getTime());
}

// The day an occurrence starting at `start` is on: the zone's day for a timed event, the UTC
// date for an all-day one. A series repeats at most once a day, so this names an occurrence.
export function eventDay(allDay: boolean, start: Date, tz: string): DateStr {
  return allDay ? fromDbDate(start) : todayIn(tz, start);
}

// The series' original start on `day`, or null when it has no occurrence that day.
export function eventStartOn(event: EventSeries, day: DateStr, tz: string): Date | null {
  const { start, end } = rangeBounds(event.allDay, day, day, tz);
  return eventStarts(event, start, end, tz).find((s) => eventDay(event.allDay, s, tz) === day) ?? null;
}

// Original starts of the series' occurrences before `before`, oldest first, cancelled ones
// included.
export function eventStartsBefore(event: EventSeries, before: Date, tz: string): Date[] {
  return eventStarts(event, event.startAt, before, tz).filter((start) => start < before);
}

// Occurrences overlapping firstDay..lastDay (inclusive) in the user's zone, by start.
export function expandEvent<T extends EventSeries>(
  event: T,
  exceptions: EventExceptionInput[],
  firstDay: DateStr,
  lastDay: DateStr,
  tz: string,
): Array<Omit<T, keyof EventOccurrence> & EventOccurrence> {
  const range = rangeBounds(event.allDay, firstDay, lastDay, tz);
  const duration = event.endAt.getTime() - event.startAt.getTime();
  const byStart = new Map(exceptions.map((e) => [e.occurrenceStart.getTime(), e]));
  const starts = eventStarts(event, range.start, range.end, tz);
  // Occurrences moved into the range from outside it.
  for (const e of exceptions) {
    if (e.cancelled || (!e.startAt && !e.endAt)) continue;
    if (starts.some((start) => start.getTime() === e.occurrenceStart.getTime())) continue;
    if (isEventOccurrence(event, e.occurrenceStart, tz)) starts.push(e.occurrenceStart);
  }

  return starts
    .flatMap((occurrenceStart) => {
      const exception = byStart.get(occurrenceStart.getTime());
      if (exception?.cancelled) return [];
      const startAt = exception?.startAt ?? occurrenceStart;
      const endAt = exception?.endAt ?? new Date(startAt.getTime() + duration);
      if (startAt >= range.end || endAt <= range.start) return [];
      return [
        {
          ...event,
          occurrenceStart,
          startAt,
          endAt,
          title: exception?.title ?? event.title,
          notes: exception?.notes ?? event.notes,
          location: exception?.location ?? event.location,
        },
      ];
    })
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
