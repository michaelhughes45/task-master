import { addDays, addWeeks, resolveTimezone, todayIn, weekStartOf } from "@/lib/dates";
import { isReviewReady } from "@/lib/review-view";
import type { DateStr } from "@/types/dates";
import type { ReviewTotals } from "@/types/review";

// The cron runs once a week (vercel.json), late enough on Sunday that the review is ready in
// every US zone, Hawaii included. Each user hears about the week whose Sunday is today or most
// recently past in their zone. If that week isn't ready yet (a zone west of Hawaii), they're
// skipped rather than sent last week's review a second time.

export interface ReviewNotice<T> {
  user: T;
  tz: string;
  weekStart: DateStr;
}

// The Monday of the week ending on today's Sunday, or on the last Sunday before today.
function endingWeek(tz: string, now: Date): DateStr {
  const today = todayIn(tz, now);
  const monday = weekStartOf(today);
  return today === addDays(monday, 6) ? monday : addWeeks(monday, -1);
}

// A missing or invalid timezone counts as UTC, like elsewhere.
export function reviewNotices<T extends { timezone: string | null }>(users: T[], now: Date): ReviewNotice<T>[] {
  return users.flatMap((user) => {
    const tz = resolveTimezone(user);
    const weekStart = endingWeek(tz, now);
    return isReviewReady(weekStart, tz, now) ? [{ user, tz, weekStart }] : [];
  });
}

export const REVIEW_NOTIFICATION_TITLE = "Your weekly review is ready";

// "You finished 28 of 36 tasks this week."
export function reviewNotificationBody({ planned, done }: Pick<ReviewTotals, "planned" | "done">) {
  if (planned === 0) return "See how your week went and plan the next one.";
  const noun = planned === 1 ? "task" : "tasks";
  return `You finished ${done} of ${planned} ${noun} this week.`;
}
