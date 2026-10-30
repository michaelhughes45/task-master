import type { z } from "zod";
import { addDays, instantToWallTime, toDbDate, wallTimeToInstant } from "@/lib/dates";
import {
  eventDay,
  eventStartOn,
  eventStartsBefore,
  expandTask,
  isTaskOccurrence,
  taskDatesBefore,
  type EventExceptionInput,
  type EventSeries,
  type TaskExceptionInput,
  type TaskSeries,
} from "@/lib/recurrence";
import {
  WEEKDAYS,
  buildRRule,
  normalizeRRule,
  nthWeekdayOf,
  parseRRule,
  repeatProblem,
  type MonthlyRepeat,
  type RepeatEnd,
} from "@/lib/rrule-builder";
import type { editScopeSchema } from "@/lib/validations/repeat";
import type { DateStr } from "@/types/dates";
import type { EventColor } from "@/types/events";
import type { Priority } from "@/types/tasks";

// What to write when one occurrence of a repeating task or event is edited or deleted, for
// each scope (Google Calendar's "This event", "This and following events", "All events").
// Pure: the actions load the series, ask for a plan and run it in one transaction.
//
// - This one: an exception row for the occurrence (changed or cancelled).
// - This and following: the series ends the occurrence before; an edit starts a new series at
//   the occurrence, taking the later exceptions and completions that still match it. On the
//   first occurrence it's the same as All.
// - All: the series itself changes or is deleted.

export type EditScope = z.infer<typeof editScopeSchema>;

export const NOT_AN_OCCURRENCE = "That occurrence isn't in the series any more.";
const CANT_SPLIT = "That repeat rule can't be split. Edit all occurrences instead.";
const DAY_MS = 24 * 60 * 60 * 1000;

type PlanError = { type: "error"; error: string; field?: string };

function fail(error: string, field?: string): PlanError {
  return { type: "error", error, field };
}

function sameTime(a: Date, b: Date) {
  return a.getTime() === b.getTime();
}

// ---------------------------------------------------------------------------------------------
// Rules. Ends are written as the series wrote its dates: an event's floating day (spec 15) or
// a task's date, as a date-only UNTIL that includes that whole day.

// The rule cut to end just before an occurrence, given the dates of the occurrences before it
// (at least one): a COUNT becomes how many came before; otherwise UNTIL the last of them.
export function endRuleBefore(rrule: string, earlier: DateStr[]): string | null {
  const options = parseRRule(rrule);
  const last = earlier.at(-1);
  if (!options || !last) return null;
  const end: RepeatEnd =
    options.end.type === "count" ? { type: "count", count: earlier.length } : { type: "until", until: last };
  return buildRRule({ ...options, end });
}

// The rule for a series that carries on from that occurrence: a COUNT keeps what's left.
export function continueRule(rrule: string, earlierCount: number): string | null {
  const options = parseRRule(rrule);
  if (!options) return null;
  if (options.end.type !== "count") return buildRRule(options);
  return buildRRule({ ...options, end: { type: "count", count: options.end.count - earlierCount } });
}

// The rule re-anchored for a series moved `shift` days to start on `startDay`: weekdays move by
// the same number of days, and monthly days to the new start's. Rules anchored on the start
// alone (daily, yearly, weekly without days) need nothing.
export function shiftRule(rrule: string, shift: number, startDay: DateStr): string | null {
  const options = parseRRule(rrule);
  if (!options || shift === 0) return options && buildRRule(options);
  const weekdays = options.weekdays.map((day) => WEEKDAYS[(WEEKDAYS.indexOf(day) + (shift % 7) + 7) % 7]);
  const monthly: MonthlyRepeat | null =
    options.monthly?.by === "day"
      ? { by: "day", day: Number(startDay.slice(8)) }
      : options.monthly && { by: "weekday", ...nthWeekdayOf(startDay) };
  return buildRRule({ ...options, weekdays, monthly });
}

// ---------------------------------------------------------------------------------------------
// Tasks. Only the title can be changed for one occurrence (an exception holds no priority),
// and only one occurrence can be moved to another day.

export interface RepeatingTask extends TaskSeries {
  rrule: string;
  priority: Priority;
}

export interface TaskEdit {
  title?: string;
  priority?: Priority;
  date?: DateStr;
}

export interface NewTaskSeries {
  date: DateStr;
  rrule: string;
  title: string;
  priority: Priority;
}

export type TaskPlan =
  // Upsert the occurrence's exception.
  | { type: "exception"; row: TaskExceptionInput }
  // Update the series; when `exceptions` is set, they replace the series' exceptions.
  | { type: "update"; data: { title?: string; priority?: Priority }; exceptions: TaskExceptionInput[] | null }
  // End the series with `rule`, create `next` with `exceptions`, move `completions` to it, and
  // drop everything else of the old series from `from` on.
  | {
      type: "split";
      from: DateStr;
      rule: string;
      next: NewTaskSeries;
      exceptions: TaskExceptionInput[];
      completions: DateStr[];
    }
  // End the series with `rule` and drop its exceptions and completions from `from` on.
  | { type: "end"; from: DateStr; rule: string }
  | { type: "delete" }
  | PlanError;

function hasTaskOverride(e: TaskExceptionInput) {
  return e.cancelled || e.title !== null || e.date !== null;
}

function blankTaskException(occurrenceDate: DateStr): TaskExceptionInput {
  return { occurrenceDate, cancelled: false, title: null, date: null };
}

// Whether another occurrence of the series is shown on `day`, so moving one there would list
// the task twice.
function isTaken(task: RepeatingTask, exceptions: TaskExceptionInput[], moving: DateStr, day: DateStr) {
  return expandTask(task, exceptions, day, day).some((o) => o.occurrenceDate !== moving);
}

export function planTaskEdit(
  task: RepeatingTask,
  exceptions: TaskExceptionInput[],
  completionDates: DateStr[],
  occurrenceDate: DateStr,
  scope: EditScope,
  edit: TaskEdit,
): TaskPlan {
  if (!isTaskOccurrence(task, exceptions, occurrenceDate)) return fail(NOT_AN_OCCURRENCE);
  const renamed = edit.title !== undefined && edit.title !== task.title;

  if (scope === "this") {
    if (edit.priority !== undefined) return fail("Priority changes apply to this and following tasks, or all of them.");
    const row = exceptions.find((e) => e.occurrenceDate === occurrenceDate) ?? blankTaskException(occurrenceDate);
    const title = edit.title === undefined ? row.title : edit.title === task.title ? null : edit.title;
    const date = edit.date === undefined ? row.date : edit.date === occurrenceDate ? null : edit.date;
    if (edit.date !== undefined && isTaken(task, exceptions, occurrenceDate, edit.date)) {
      return fail("This task is already on that day.");
    }
    return { type: "exception", row: { ...row, title, date } };
  }
  if (edit.date !== undefined) return fail("Only one occurrence can be moved at a time.");

  const data = { title: edit.title, priority: edit.priority };
  // Renaming the series renames its renamed occurrences too.
  const carry = (e: TaskExceptionInput) => (renamed ? { ...e, title: null } : e);
  const earlier = taskDatesBefore(task, occurrenceDate);
  if (scope === "all" || earlier.length === 0) {
    return { type: "update", data, exceptions: renamed ? exceptions.map(carry).filter(hasTaskOverride) : null };
  }

  const rule = endRuleBefore(task.rrule, earlier);
  const nextRule = continueRule(task.rrule, earlier.length);
  if (!rule || !nextRule) return fail(CANT_SPLIT);
  const next: NewTaskSeries = {
    date: occurrenceDate,
    rrule: nextRule,
    title: edit.title ?? task.title,
    priority: edit.priority ?? task.priority,
  };
  const matches = (day: DateStr) => day >= occurrenceDate && isTaskOccurrence({ ...task, ...next }, [], day);
  return {
    type: "split",
    from: occurrenceDate,
    rule,
    next,
    exceptions: exceptions
      .filter((e) => matches(e.occurrenceDate))
      .map(carry)
      .filter(hasTaskOverride),
    completions: completionDates.filter(matches),
  };
}

export function planTaskDelete(
  task: RepeatingTask,
  exceptions: TaskExceptionInput[],
  occurrenceDate: DateStr,
  scope: EditScope,
): TaskPlan {
  if (!isTaskOccurrence(task, exceptions, occurrenceDate)) return fail(NOT_AN_OCCURRENCE);
  if (scope === "this") {
    const row = exceptions.find((e) => e.occurrenceDate === occurrenceDate) ?? blankTaskException(occurrenceDate);
    return { type: "exception", row: { ...row, cancelled: true } };
  }
  const earlier = taskDatesBefore(task, occurrenceDate);
  if (scope === "all" || earlier.length === 0) return { type: "delete" };
  const rule = endRuleBefore(task.rrule, earlier);
  return rule ? { type: "end", from: occurrenceDate, rule } : fail(CANT_SPLIT);
}

// ---------------------------------------------------------------------------------------------
// Events. The form sends every field, so a change is whatever differs from the occurrence as
// it was shown. Color, all day and the repeat belong to the series, never to one occurrence.

export interface RepeatingEvent extends EventSeries {
  rrule: string;
  color: EventColor;
}

// An event row's fields: the form's values (times as instants), or a new series.
export interface EventValues {
  title: string;
  notes: string | null;
  location: string | null;
  color: EventColor;
  allDay: boolean;
  rrule: string | null;
  startAt: Date;
  endAt: Date;
}

export type EventPlan =
  | { type: "exception"; row: EventExceptionInput }
  // Update the series; its exceptions are replaced by `exceptions`.
  | { type: "update"; data: EventValues; exceptions: EventExceptionInput[] }
  // End the series with `rule`, create `next` with `exceptions`, and drop the old series'
  // exceptions from `from` on.
  | { type: "split"; from: Date; rule: string; next: EventValues; exceptions: EventExceptionInput[] }
  | { type: "end"; from: Date; rule: string }
  | { type: "delete" }
  | PlanError;

function duration(event: EventSeries) {
  return event.endAt.getTime() - event.startAt.getTime();
}

function daysBetween(from: DateStr, to: DateStr) {
  return Math.round((toDbDate(to).getTime() - toDbDate(from).getTime()) / DAY_MS);
}

// The occurrence as shown (exception applied), or null if it isn't a live occurrence.
function findOccurrence(event: RepeatingEvent, exceptions: EventExceptionInput[], occurrenceStart: Date, tz: string) {
  const start = eventStartOn(event, eventDay(event.allDay, occurrenceStart, tz), tz);
  if (!start || !sameTime(start, occurrenceStart)) return null;
  const exception = exceptions.find((e) => sameTime(e.occurrenceStart, occurrenceStart));
  if (exception?.cancelled) return null;
  const startAt = exception?.startAt ?? occurrenceStart;
  return {
    // A cleared override is stored as "", and the form sends it back as null.
    title: exception?.title ?? event.title,
    notes: (exception?.notes ?? event.notes) || null,
    location: (exception?.location ?? event.location) || null,
    startAt,
    endAt: exception?.endAt ?? new Date(startAt.getTime() + duration(event)),
  };
}

// An exception's text override: null when it matches the series, "" when it clears it.
function textOverride(value: string | null, series: string | null) {
  return value === (series || null) ? null : (value ?? "");
}

function hasEventOverride(e: EventExceptionInput) {
  return e.cancelled || [e.title, e.notes, e.location, e.startAt, e.endAt].some((value) => value !== null);
}

// The new times of a series whose occurrence moved `shift` days and to the form's times: the
// series' own start (`base`) moves by the same number of days and takes the form's wall times.
function movedTimes(base: Date, shift: number, values: EventValues, wasAllDay: boolean, tz: string) {
  const formDay = eventDay(values.allDay, values.startAt, tz);
  const day = addDays(eventDay(wasAllDay, base, tz), shift);
  const endDay = addDays(day, daysBetween(formDay, eventDay(values.allDay, values.endAt, tz)));
  if (values.allDay) return { startAt: toDbDate(day), endAt: toDbDate(endDay) };
  const startAt = wallTimeToInstant(day, instantToWallTime(values.startAt, tz), tz);
  const endAt = wallTimeToInstant(endDay, instantToWallTime(values.endAt, tz), tz);
  return endAt > startAt ? { startAt, endAt } : null;
}

export function planEventEdit(
  event: RepeatingEvent,
  exceptions: EventExceptionInput[],
  occurrenceStart: Date,
  scope: EditScope,
  values: EventValues,
  tz: string,
): EventPlan {
  const shown = findOccurrence(event, exceptions, occurrenceStart, tz);
  if (!shown) return fail(NOT_AN_OCCURRENCE);
  const keepsRule = values.rrule === (normalizeRRule(event.rrule) ?? event.rrule);
  const changed = {
    title: values.title !== shown.title,
    notes: values.notes !== shown.notes,
    location: values.location !== shown.location,
    times: !sameTime(values.startAt, shown.startAt) || !sameTime(values.endAt, shown.endAt),
    allDay: values.allDay !== event.allDay,
    series: values.color !== event.color || values.allDay !== event.allDay || !keepsRule,
  };
  const originalEnd = new Date(occurrenceStart.getTime() + duration(event));

  if (scope === "this") {
    if (changed.series) {
      return fail("Color, all day and repeat changes apply to this and following events, or all of them.");
    }
    const moved = !sameTime(values.startAt, occurrenceStart) || !sameTime(values.endAt, originalEnd);
    return {
      type: "exception",
      row: {
        occurrenceStart,
        cancelled: false,
        title: values.title === event.title ? null : values.title,
        notes: textOverride(values.notes, event.notes),
        location: textOverride(values.location, event.location),
        // Both or neither: an exception's end otherwise follows its start by the series' length.
        startAt: moved ? values.startAt : null,
        endAt: moved ? values.endAt : null,
      },
    };
  }

  const earlier = scope === "following" ? eventStartsBefore(event, occurrenceStart, tz) : [];
  const splitting = earlier.length > 0;
  const base = splitting ? { startAt: occurrenceStart, endAt: originalEnd } : event;
  const shift = daysBetween(eventDay(event.allDay, shown.startAt, tz), eventDay(values.allDay, values.startAt, tz));
  const times = changed.times || changed.allDay ? movedTimes(base.startAt, shift, values, event.allDay, tz) : base;
  if (!times) return fail("End time must be after the start time", "endTime");

  // A kept rule moves with the date, so "Weekly on Monday" moved to a Tuesday repeats on Tuesdays.
  const kept = splitting ? continueRule(event.rrule, earlier.length) : event.rrule;
  const rrule = keepsRule ? kept && shiftRule(kept, shift, eventDay(values.allDay, times.startAt, tz)) : values.rrule;
  const rule = splitting
    ? endRuleBefore(
        event.rrule,
        earlier.map((start) => eventDay(event.allDay, start, tz)),
      )
    : null;
  if (splitting && (!rule || (keepsRule && !rrule))) return fail(CANT_SPLIT);
  const problem = rrule && repeatProblem(rrule, "DAILY", eventDay(values.allDay, times.startAt, tz));
  if (problem) return fail(problem, "rrule");

  const next: EventValues = {
    title: changed.title ? values.title : event.title,
    notes: changed.notes ? values.notes : event.notes,
    location: changed.location ? values.location : event.location,
    color: values.color,
    allDay: values.allDay,
    rrule,
    startAt: times.startAt,
    endAt: times.endAt,
  };

  // Exceptions stay on their day if the changed series still has an occurrence there. Fields
  // changed for the whole series drop their overrides, and the edited occurrence takes the
  // new times.
  const carried = exceptions
    .filter((e) => !splitting || e.occurrenceStart >= occurrenceStart)
    .flatMap((e) => {
      const key = rrule && eventStartOn({ ...next, rrule }, eventDay(event.allDay, e.occurrenceStart, tz), tz);
      if (!key) return [];
      const resetTimes = changed.allDay || (changed.times && sameTime(e.occurrenceStart, occurrenceStart));
      const row: EventExceptionInput = {
        occurrenceStart: key,
        cancelled: e.cancelled,
        title: changed.title ? null : e.title,
        notes: changed.notes ? null : e.notes,
        location: changed.location ? null : e.location,
        startAt: resetTimes ? null : e.startAt,
        endAt: resetTimes ? null : e.endAt,
      };
      return hasEventOverride(row) ? [row] : [];
    });

  if (rule) return { type: "split", from: occurrenceStart, rule, next, exceptions: carried };
  return { type: "update", data: next, exceptions: carried };
}

export function planEventDelete(
  event: RepeatingEvent,
  exceptions: EventExceptionInput[],
  occurrenceStart: Date,
  scope: EditScope,
  tz: string,
): EventPlan {
  if (!findOccurrence(event, exceptions, occurrenceStart, tz)) return fail(NOT_AN_OCCURRENCE);
  if (scope === "this") {
    const existing = exceptions.find((e) => sameTime(e.occurrenceStart, occurrenceStart));
    const row = existing ?? {
      occurrenceStart,
      cancelled: false,
      title: null,
      startAt: null,
      endAt: null,
      notes: null,
      location: null,
    };
    return { type: "exception", row: { ...row, cancelled: true } };
  }
  const earlier = scope === "following" ? eventStartsBefore(event, occurrenceStart, tz) : [];
  if (earlier.length === 0) return { type: "delete" };
  const rule = endRuleBefore(
    event.rrule,
    earlier.map((start) => eventDay(event.allDay, start, tz)),
  );
  return rule ? { type: "end", from: occurrenceStart, rule } : fail(CANT_SPLIT);
}
