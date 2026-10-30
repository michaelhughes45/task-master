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
import type { Prisma } from "@/generated/prisma/client";
import type { DateStr } from "@/types/dates";
import type { DayCount, TaskView } from "@/types/tasks";

const TASK_SELECT = {
  id: true,
  title: true,
  notes: true,
  scope: true,
  priority: true,
  date: true,
  completions: {
    select: { occurrenceDate: true, completedAt: true, minutesSpent: true, workNote: true },
  },
} satisfies Prisma.TaskSelect;

const ORDER_BY = [{ date: "asc" }, { createdAt: "asc" }] satisfies Prisma.TaskOrderByWithRelationInput[];

type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

// Tasks don't repeat yet, so a task's only occurrence is its own date.
export function toTaskView(task: TaskRow, tz: string): TaskView {
  const day = fromDbDate(task.date);
  const completion = task.completions.find((c) => fromDbDate(c.occurrenceDate) === day);
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    scope: task.scope,
    priority: task.priority,
    day,
    done: completion !== undefined,
    doneLate:
      completion !== undefined &&
      isDoneLate({ occurrenceDay: day, scope: task.scope, completedAt: completion.completedAt, tz }),
    minutesSpent: completion?.minutesSpent ?? null,
    workNote: completion?.workNote ?? null,
  };
}

export async function getDayTasks(userId: string, day: DateStr, tz: string): Promise<TaskView[]> {
  const tasks = await prisma.task.findMany({
    where: { userId, scope: "DAILY", date: toDbDate(day) },
    select: TASK_SELECT,
    orderBy: ORDER_BY,
  });
  return tasks.map((task) => toTaskView(task, tz));
}

export async function getWeekTasks(
  userId: string,
  weekStart: DateStr,
  tz: string,
): Promise<TaskView[]> {
  const tasks = await prisma.task.findMany({
    where: { userId, scope: "WEEKLY", date: toDbDate(weekStartOf(weekStart)) },
    select: TASK_SELECT,
    orderBy: ORDER_BY,
  });
  return tasks.map((task) => toTaskView(task, tz));
}

export async function getWeekDayCounts(userId: string, weekStart: DateStr): Promise<DayCount[]> {
  const monday = weekStartOf(weekStart);
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      scope: "DAILY",
      date: { gte: toDbDate(monday), lt: toDbDate(addDays(monday, 7)) },
    },
    select: { date: true, completions: { select: { occurrenceDate: true } } },
  });

  return weekDays(monday).map((day) => {
    const onDay = tasks.filter((task) => fromDbDate(task.date) === day);
    const done = onDay.filter((task) =>
      task.completions.some((c) => fromDbDate(c.occurrenceDate) === day),
    ).length;
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

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      scope: "DAILY",
      date: { gte: toDbDate(monday), lt: toDbDate(today) },
      OR: [
        { completions: { none: {} } },
        {
          completions: {
            some: {
              completedAt: { gte: dayStartInstant(today, tz), lt: dayEndInstant(today, tz) },
            },
          },
        },
      ],
    },
    select: TASK_SELECT,
    orderBy: ORDER_BY,
  });
  return tasks.map((task) => toTaskView(task, tz));
}
