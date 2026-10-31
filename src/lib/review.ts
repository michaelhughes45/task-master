import { addDays, isDoneLate, todayIn, weekDays, weekStartOf } from "@/lib/dates";
import { isPastOccurrence } from "@/lib/task-list";
import type { DateStr } from "@/types/dates";
import type {
  ReviewComparison,
  ReviewDoneItem,
  ReviewMissedTask,
  ReviewNote,
  ReviewOccurrence,
  ReviewRate,
  ReviewTaskTime,
  WeeklyReview,
  WeeklyReviewInput,
} from "@/types/review";

const TOP_TIMES = 5;
const TOP_MISSED = 3;

export function completionRate(done: number, planned: number): number | null {
  return planned === 0 ? null : Math.round((done / planned) * 100);
}

function rateOf(occurrences: ReviewOccurrence[]): ReviewRate {
  const done = occurrences.filter((o) => o.completion !== null).length;
  return { planned: occurrences.length, done, rate: completionRate(done, occurrences.length) };
}

function minutesOf(occurrences: ReviewOccurrence[]) {
  return occurrences.reduce((sum, o) => sum + (o.completion?.minutesSpent ?? 0), 0);
}

// Only the week's own occurrences: daily ones shown Monday to Sunday, weekly ones on its Monday.
function inWeek(occurrences: ReviewOccurrence[], monday: DateStr) {
  const sunday = addDays(monday, 6);
  return occurrences.filter((o) =>
    o.scope === "WEEKLY" ? o.day === monday : monday <= o.day && o.day <= sunday,
  );
}

function byDay(a: ReviewOccurrence, b: ReviewOccurrence) {
  return a.day.localeCompare(b.day);
}

function timeByTask(occurrences: ReviewOccurrence[]): ReviewTaskTime[] {
  const totals = new Map<string, ReviewTaskTime>();
  for (const o of occurrences) {
    const minutes = o.completion?.minutesSpent ?? 0;
    if (minutes === 0) continue;
    const entry = totals.get(o.taskId);
    // The latest occurrence's title, in case one was renamed.
    totals.set(o.taskId, { taskId: o.taskId, title: o.title, minutes: (entry?.minutes ?? 0) + minutes });
  }
  return [...totals.values()]
    .sort((a, b) => b.minutes - a.minutes || a.title.localeCompare(b.title))
    .slice(0, TOP_TIMES);
}

function mostMissed(occurrences: ReviewOccurrence[], isMissed: (o: ReviewOccurrence) => boolean) {
  const counts = new Map<string, ReviewMissedTask>();
  for (const o of occurrences) {
    if (!o.repeats) continue;
    const entry = counts.get(o.taskId) ?? { taskId: o.taskId, title: o.title, scope: o.scope, missed: 0, planned: 0 };
    counts.set(o.taskId, {
      ...entry,
      title: o.title,
      planned: entry.planned + 1,
      missed: entry.missed + (isMissed(o) ? 1 : 0),
    });
  }
  return [...counts.values()]
    .filter((t) => t.missed > 0)
    .sort(
      (a, b) =>
        b.missed - a.missed || b.missed / b.planned - a.missed / a.planned || a.title.localeCompare(b.title),
    )
    .slice(0, TOP_MISSED);
}

// Weekly tasks have no day of their own, so their notes sit on the day they were ticked,
// kept within the week (a late tick lands on Sunday).
function noteDay(o: ReviewOccurrence, completedAt: Date, tz: string): DateStr {
  if (o.scope === "DAILY") return o.day;
  const ticked = todayIn(tz, completedAt);
  const sunday = addDays(o.day, 6);
  if (ticked < o.day) return o.day;
  return ticked > sunday ? sunday : ticked;
}

function notesOf(occurrences: ReviewOccurrence[], tz: string): ReviewNote[] {
  return occurrences
    .flatMap((o) => {
      const c = o.completion;
      if (!c?.workNote) return [];
      const note: ReviewNote = {
        day: noteDay(o, c.completedAt, tz),
        taskId: o.taskId,
        title: o.title,
        scope: o.scope,
        minutesSpent: c.minutesSpent,
        note: c.workNote,
      };
      return [{ note, at: c.completedAt.getTime() }];
    })
    .sort((a, b) => a.note.day.localeCompare(b.note.day) || a.at - b.at)
    .map(({ note }) => note);
}

function compare(rate: number | null, minutes: number, previous: ReviewOccurrence[]): ReviewComparison | null {
  const { planned, rate: previousRate } = rateOf(previous);
  if (planned === 0) return null;
  const previousMinutes = minutesOf(previous);
  return {
    previousRate,
    rateChange: rate === null || previousRate === null ? null : rate - previousRate,
    previousMinutes,
    minutesChange: minutes - previousMinutes,
  };
}

// The numbers for one Monday–Sunday week. Planned = every occurrence given (cancelled ones are
// already gone); each weekly task counts once for the week. A not-done occurrence whose day (or
// week) isn't over yet is open, not missed.
export function computeWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const { today, tz } = input;
  const monday = weekStartOf(input.weekStart);
  const week = inWeek(input.occurrences, monday).sort(byDay);
  const daily = week.filter((o) => o.scope === "DAILY");
  const isLate = (o: ReviewOccurrence) =>
    o.completion !== null && isDoneLate({ occurrenceDay: o.day, scope: o.scope, completedAt: o.completion.completedAt, tz });
  const isMissed = (o: ReviewOccurrence) => o.completion === null && isPastOccurrence(o, today);

  const done: ReviewDoneItem[] = week.flatMap((o) =>
    o.completion === null
      ? []
      : [
          {
            taskId: o.taskId,
            title: o.title,
            scope: o.scope,
            day: o.day,
            late: isLate(o),
            completedOn: todayIn(tz, o.completion.completedAt),
            minutesSpent: o.completion.minutesSpent,
          },
        ],
  );
  const missed = week.filter(isMissed).map(({ taskId, title, scope, day }) => ({ taskId, title, scope, day }));
  const totals = rateOf(week);
  const minutesTracked = minutesOf(week);
  const previous = input.previous && inWeek(input.previous, addDays(monday, -7));

  return {
    weekStart: monday,
    totals: {
      ...totals,
      doneLate: done.filter((d) => d.late).length,
      missed: missed.length,
      open: totals.planned - totals.done - missed.length,
    },
    daily: rateOf(daily),
    weekly: rateOf(week.filter((o) => o.scope === "WEEKLY")),
    done,
    missed,
    minutesTracked,
    timeByTask: timeByTask(week),
    perDay: weekDays(monday).map((day) => {
      const { planned, done } = rateOf(daily.filter((o) => o.day === day));
      return { day, planned, done };
    }),
    mostMissed: mostMissed(week, isMissed),
    notes: notesOf(week, tz),
    comparison: previous ? compare(totals.rate, minutesTracked, previous) : null,
  };
}
