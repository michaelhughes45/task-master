import "server-only";
import {
  addDays,
  dayEndInstant,
  dayStartInstant,
  fromDbDate,
  isDoneLate,
  toDbDate,
  weekDays,
  weekStartOf,
} from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { expandTask, type TaskOccurrence } from "@/lib/recurrence";
import { describeRRule } from "@/lib/rrule-builder";
import type { Prisma } from "@/generated/prisma/client";
import type { DateStr, TaskScope } from "@/types/dates";
import type { DayCount, TaskView } from "@/types/tasks";

const COMPLETION_SELECT = {
  occurrenceDate: true,
  completedAt: true,
  minutesSpent: true,
  workNote: true,
} satisfies Prisma.TaskCompletionSelect;

// Completions are limited to the range: a daily series collects one a day.
function taskSelect(first: Date, last: Date) {
  return {
    id: true,
    title: true,
    notes: true,
    scope: true,
    priority: true,
    date: true,
    rrule: true,
    exceptions: { select: { occurrenceDate: true, cancelled: true, title: true, date: true } },
    completions: { where: { occurrenceDate: { gte: first, lte: last } }, select: COMPLETION_SELECT },
  } satisfies Prisma.TaskSelect;
}

const ORDER_BY = [{ date: "asc" }, { createdAt: "asc" }] satisfies Prisma.TaskOrderByWithRelationInput[];

type TaskRow = Prisma.TaskGetPayload<{ select: ReturnType<typeof taskSelect> }>;
type Completion = Prisma.TaskCompletionGetPayload<{ select: typeof COMPLETION_SELECT }>;

interface Occurrence {
  task: TaskRow;
  occurrence: TaskOccurrence;
  completion: Completion | undefined;
}

// Lateness counts from the day (or week) the occurrence is shown on.
export function toTaskView(
  task: TaskRow,
  occurrence: TaskOccurrence,
  completion: Completion | undefined,
  tz: string,
): TaskView {
  return {
    id: task.id,
    title: occurrence.title,
    notes: task.notes,
    scope: task.scope,
    priority: task.priority,
    day: occurrence.date,
    occurrenceDate: occurrence.occurrenceDate,
    done: completion !== undefined,
    doneLate:
      completion !== undefined &&
      isDoneLate({ occurrenceDay: occurrence.date, scope: task.scope, completedAt: completion.completedAt, tz }),
    minutesSpent: completion?.minutesSpent ?? null,
    workNote: completion?.workNote ?? null,
    repeats: task.rrule !== null,
    repeatLabel: task.rrule ? describeRRule(task.rrule, occurrence.occurrenceDate) : null,
  };
}

function expandRow(task: TaskRow, firstDay: DateStr, lastDay: DateStr) {
  const exceptions = task.exceptions.map((e) => ({
    ...e,
    occurrenceDate: fromDbDate(e.occurrenceDate),
    date: e.date && fromDbDate(e.date),
  }));
  return expandTask({ ...task, date: fromDbDate(task.date) }, exceptions, firstDay, lastDay);
}

const completionKey = (taskId: string, occurrenceDate: DateStr) => `${taskId}|${occurrenceDate}`;

// Every occurrence of the user's tasks of one scope shown from firstDay to lastDay (inclusive),
// by day, then in list order, with its completion. Loads one-off tasks in the range and every
// repeating series that started by its end, then expands them.
export async function findOccurrences(
  userId: string,
  scope: TaskScope,
  firstDay: DateStr,
  lastDay: DateStr,
): Promise<Occurrence[]> {
  const first = toDbDate(firstDay);
  const last = toDbDate(lastDay);
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      scope,
      OR: [{ rrule: null, date: { gte: first, lte: last } }, { rrule: { not: null }, date: { lte: last } }],
    },
    select: taskSelect(first, last),
    orderBy: ORDER_BY,
  });

  const found = tasks.flatMap((task) =>
    expandRow(task, firstDay, lastDay).map((occurrence) => ({ task, occurrence })),
  );
  const completions = new Map(
    tasks.flatMap((task) => task.completions.map((c) => [completionKey(task.id, fromDbDate(c.occurrenceDate)), c])),
  );
  // An occurrence moved in from outside the range has its completion outside it too.
  const movedIn = found.filter(({ occurrence }) => occurrence.occurrenceDate < firstDay || occurrence.occurrenceDate > lastDay);
  if (movedIn.length > 0) {
    const extra = await prisma.taskCompletion.findMany({
      where: {
        OR: movedIn.map(({ task, occurrence }) => ({ taskId: task.id, occurrenceDate: toDbDate(occurrence.occurrenceDate) })),
      },
      select: { taskId: true, ...COMPLETION_SELECT },
    });
    for (const { taskId, ...c } of extra) completions.set(completionKey(taskId, fromDbDate(c.occurrenceDate)), c);
  }

  // Stable, so tasks on the same day keep the query's order.
  return found
    .map(({ task, occurrence }) => ({
      task,
      occurrence,
      completion: completions.get(completionKey(task.id, occurrence.occurrenceDate)),
    }))
    .sort((a, b) => a.occurrence.date.localeCompare(b.occurrence.date));
}

function toViews(occurrences: Occurrence[], tz: string) {
  return occurrences.map(({ task, occurrence, completion }) => toTaskView(task, occurrence, completion, tz));
}

export async function getDayTasks(userId: string, day: DateStr, tz: string): Promise<TaskView[]> {
  return toViews(await findOccurrences(userId, "DAILY", day, day), tz);
}

export async function getWeekTasks(
  userId: string,
  weekStart: DateStr,
  tz: string,
): Promise<TaskView[]> {
  const monday = weekStartOf(weekStart);
  return toViews(await findOccurrences(userId, "WEEKLY", monday, monday), tz);
}

export async function getWeekDayCounts(userId: string, weekStart: DateStr): Promise<DayCount[]> {
  const monday = weekStartOf(weekStart);
  const occurrences = await findOccurrences(userId, "DAILY", monday, addDays(monday, 6));

  return weekDays(monday).map((day) => {
    const onDay = occurrences.filter(({ occurrence }) => occurrence.date === day);
    const done = onDay.filter(({ completion }) => completion !== undefined).length;
    return { day, done, total: onDay.length };
  });
}

// Daily tasks from earlier days this week that are still open, plus ones ticked off (late)
// today, so they don't vanish from the list the moment they're ticked.
export async function getOpenEarlier(
  userId: string,
  today: DateStr,
  tz: string,
): Promise<TaskView[]> {
  const monday = weekStartOf(today);
  if (monday === today) return [];

  const todayStart = dayStartInstant(today, tz);
  const todayEnd = dayEndInstant(today, tz);
  const occurrences = await findOccurrences(userId, "DAILY", monday, addDays(today, -1));
  return toViews(
    occurrences.filter(
      ({ completion }) =>
        completion === undefined || (completion.completedAt >= todayStart && completion.completedAt < todayEnd),
    ),
    tz,
  );
}
