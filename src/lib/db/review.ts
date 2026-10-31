import "server-only";
import { addDays, addWeeks, fromDbDate, todayIn, toDbDate, weekStartOf } from "@/lib/dates";
import { findOccurrences } from "@/lib/db/tasks";
import { prisma } from "@/lib/prisma";
import { expandTask } from "@/lib/recurrence";
import { computeWeeklyReview } from "@/lib/review";
import type { DateStr, TaskScope } from "@/types/dates";
import type { ReviewOccurrence, WeeklyReview } from "@/types/review";

const REVIEW_WEEKS = 12;

async function occurrencesOf(userId: string, scope: TaskScope, firstDay: DateStr, lastDay: DateStr) {
  const found = await findOccurrences(userId, scope, firstDay, lastDay);
  return found.map(
    ({ task, occurrence, completion }): ReviewOccurrence => ({
      taskId: task.id,
      title: occurrence.title,
      scope: task.scope,
      day: occurrence.date,
      repeats: task.rrule !== null,
      completion: completion ?? null,
    }),
  );
}

// Every occurrence from the week of `firstMonday` through the week of `lastMonday`, in one
// query per scope: daily tasks over all the days, weekly tasks over the Mondays.
async function occurrencesInWeeks(userId: string, firstMonday: DateStr, lastMonday: DateStr) {
  const [daily, weekly] = await Promise.all([
    occurrencesOf(userId, "DAILY", firstMonday, addDays(lastMonday, 6)),
    occurrencesOf(userId, "WEEKLY", firstMonday, lastMonday),
  ]);
  return [...daily, ...weekly];
}

// The review of the week holding `weekStart`, compared with the week before (both load together).
export async function getWeeklyReview(
  userId: string,
  weekStart: DateStr,
  tz: string,
  now: Date = new Date(),
): Promise<WeeklyReview> {
  const monday = weekStartOf(weekStart);
  const occurrences = await occurrencesInWeeks(userId, addWeeks(monday, -1), monday);
  return computeWeeklyReview({
    weekStart: monday,
    occurrences,
    previous: occurrences,
    today: todayIn(tz, now),
    tz,
  });
}

// Mondays of the latest 12 weeks, up to this one, with any planned task, newest first.
// One-off tasks give their weeks directly; repeating series are expanded only as far back as
// the 12th of those weeks (or their own start when there are fewer).
export async function getReviewWeeks(userId: string, tz: string, now: Date = new Date()): Promise<DateStr[]> {
  const lastDay = addDays(weekStartOf(todayIn(tz, now)), 6);
  const last = toDbDate(lastDay);
  const [oneOffs, series] = await Promise.all([
    prisma.task.findMany({
      where: { userId, rrule: null, date: { lte: last } },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
      // Enough distinct days to cover 12 weeks even when every day has a task.
      take: REVIEW_WEEKS * 7,
    }),
    prisma.task.findMany({
      where: { userId, rrule: { not: null }, date: { lte: last } },
      select: {
        scope: true,
        date: true,
        rrule: true,
        title: true,
        exceptions: { select: { occurrenceDate: true, cancelled: true, title: true, date: true } },
      },
    }),
  ]);

  const weeks = new Set(oneOffs.map((task) => weekStartOf(fromDbDate(task.date))));
  const known = [...weeks].sort().reverse();
  for (const task of series) {
    const date = fromDbDate(task.date);
    const from = known.length >= REVIEW_WEEKS && known[REVIEW_WEEKS - 1] > date ? known[REVIEW_WEEKS - 1] : date;
    const exceptions = task.exceptions.map((e) => ({
      ...e,
      occurrenceDate: fromDbDate(e.occurrenceDate),
      date: e.date && fromDbDate(e.date),
    }));
    for (const occurrence of expandTask({ ...task, date }, exceptions, from, lastDay)) {
      weeks.add(weekStartOf(occurrence.date));
    }
  }
  return [...weeks].sort().reverse().slice(0, REVIEW_WEEKS);
}

// The completion rate of each given week (Mondays), loaded together; null when nothing was planned.
export async function getWeekRates(
  userId: string,
  weekStarts: DateStr[],
  tz: string,
  now: Date = new Date(),
): Promise<Map<DateStr, number | null>> {
  if (weekStarts.length === 0) return new Map();
  const sorted = [...weekStarts].sort();
  const occurrences = await occurrencesInWeeks(userId, sorted[0], sorted[sorted.length - 1]);
  const today = todayIn(tz, now);
  return new Map(
    weekStarts.map((weekStart) => [
      weekStart,
      computeWeeklyReview({ weekStart, occurrences, previous: null, today, tz }).totals.rate,
    ]),
  );
}
