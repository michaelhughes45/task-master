import {
  addDays,
  addWeeks,
  formatDayMedium,
  formatDayShort,
  formatMinutes,
  formatTime,
  formatWeekday,
  formatWeekRange,
  todayIn,
  wallTimeToInstant,
  weekStartOf,
} from "@/lib/dates";
import type { DateStr } from "@/types/dates";
import type { ReviewDoneItem, ReviewTaskItem, WeeklyReview } from "@/types/review";

// A week's review is ready on its Sunday at 7 PM in the user's zone.
const READY_TIME = "19:00";

export function reviewReadyAt(weekStart: DateStr, tz: string): Date {
  return wallTimeToInstant(addDays(weekStartOf(weekStart), 6), READY_TIME, tz);
}

export function isReviewReady(weekStart: DateStr, tz: string, now: Date = new Date()) {
  return now.getTime() >= reviewReadyAt(weekStart, tz).getTime();
}

// "Sunday, Nov 1 at 7:00 PM"
export function formatReadyAt(weekStart: DateStr, tz: string) {
  return `${formatDayMedium(addDays(weekStartOf(weekStart), 6))} at ${formatTime(reviewReadyAt(weekStart, tz), tz)}`;
}

// The week /review opens on: this week once it's ready, otherwise last week.
export function defaultReviewWeek(tz: string, now: Date = new Date()): DateStr {
  const thisMonday = weekStartOf(todayIn(tz, now));
  return isReviewReady(thisMonday, tz, now) ? thisMonday : addWeeks(thisMonday, -1);
}

export interface ReviewWeekLink {
  weekStart: DateStr;
  label: string;
  rate: number | null;
}

interface WeekListInput {
  // Mondays with anything planned, newest first (may include this week).
  weeks: DateStr[];
  rates: Map<DateStr, number | null>;
  selected: DateStr;
  // The newest week that's ready: this week or last.
  latestReady: DateStr;
}

// The weeks to list, newest first: those ready so far, plus the selected one wherever it falls.
export function reviewWeekList({ weeks, rates, selected, latestReady }: WeekListInput): ReviewWeekLink[] {
  const shown = new Set(weeks.filter((week) => week <= latestReady));
  shown.add(selected);
  return [...shown]
    .sort()
    .reverse()
    .map((weekStart) => ({ weekStart, label: formatWeekRange(weekStart), rate: rates.get(weekStart) ?? null }));
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

// "You finished 28 of 36 tasks (78%), up from 72% the week before, and tracked 14h 20m of work.
// 3 tasks were ticked off late." Parts drop out when there's nothing to say.
export function reviewSummary(review: WeeklyReview): string {
  const { totals, comparison, minutesTracked } = review;
  let sentence = `You finished ${totals.done} of ${plural(totals.planned, "task", "tasks")} (${totals.rate ?? 0}%)`;
  const change = comparison?.rateChange ?? null;
  if (change !== null) {
    sentence +=
      change === 0
        ? ", the same as the week before"
        : `, ${change > 0 ? "up" : "down"} from ${comparison?.previousRate}% the week before`;
  }
  if (minutesTracked > 0) {
    // Non-breaking, so "14h 20m" doesn't wrap apart.
    const time = formatMinutes(minutesTracked).replace(" ", " ");
    sentence += `${change !== null ? "," : ""} and tracked ${time} of work`;
  }
  const parts = [`${sentence}.`];
  if (totals.doneLate > 0) {
    parts.push(`${plural(totals.doneLate, "task was", "tasks were")} ticked off late.`);
  }
  if (totals.open > 0) {
    parts.push(`${plural(totals.open, "is", "are")} still open.`);
  }
  return parts.join(" ");
}

export interface RateDelta {
  direction: "up" | "down" | "same";
  points: number;
}

export function rateDelta(review: WeeklyReview): RateDelta | null {
  const change = review.comparison?.rateChange;
  if (change == null) return null;
  return { direction: change > 0 ? "up" : change < 0 ? "down" : "same", points: Math.abs(change) };
}

export interface MissedGroup {
  key: string;
  title: string;
  // "Tue, Thu, Sat" or "Weekly"
  when: string;
}

// One row per task: daily tasks first with the days they were missed, then weekly ones.
export function groupMissed(missed: ReviewTaskItem[]): MissedGroup[] {
  const groups = new Map<string, { title: string; days: DateStr[]; weekly: boolean }>();
  for (const item of missed) {
    const key = `${item.scope}:${item.taskId}`;
    const group = groups.get(key) ?? { title: item.title, days: [], weekly: item.scope === "WEEKLY" };
    group.title = item.title;
    group.days.push(item.day);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => Number(a.weekly) - Number(b.weekly))
    .map(([key, group]) => ({
      key,
      title: group.title,
      when: group.weekly ? "Weekly" : group.days.map(formatWeekday).join(", "),
    }));
}

export interface LateItem {
  key: string;
  // "Read 20 pages (Mon)" or "Grocery run (weekly)"
  title: string;
  // "ticked Tue", or "ticked Mon, Oct 26" after the week
  when: string;
}

export function lateItems(done: ReviewDoneItem[], weekStart: DateStr): LateItem[] {
  const sunday = addDays(weekStartOf(weekStart), 6);
  return done
    .filter((item) => item.late)
    .map((item) => ({
      key: `${item.taskId}@${item.day}`,
      title: `${item.title} (${item.scope === "WEEKLY" ? "weekly" : formatWeekday(item.day)})`,
      when: `ticked ${item.completedOn <= sunday ? formatWeekday(item.completedOn) : formatDayShort(item.completedOn)}`,
    }));
}
