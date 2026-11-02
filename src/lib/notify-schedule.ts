import { resolveTimezone } from "@/lib/dates";
import { defaultReviewWeek } from "@/lib/review-view";
import type { DateStr } from "@/types/dates";
import type { ReviewTotals } from "@/types/review";

// The cron runs once a week (vercel.json), timed for Sunday evening in the owner's zone, and
// notifies everyone it finds. Each user hears about their latest ready week, the one /review
// opens on, so a run that lands early or late (DST, Hobby's ±59 min, another zone) still
// points at a real review instead of being skipped.

export interface ReviewNotice<T> {
  user: T;
  tz: string;
  weekStart: DateStr;
}

// A missing or invalid timezone counts as UTC, like elsewhere.
export function reviewNotices<T extends { timezone: string | null }>(users: T[], now: Date): ReviewNotice<T>[] {
  return users.map((user) => {
    const tz = resolveTimezone(user);
    return { user, tz, weekStart: defaultReviewWeek(tz, now) };
  });
}

export const REVIEW_NOTIFICATION_TITLE = "Your weekly review is ready";

// "You finished 28 of 36 tasks this week."
export function reviewNotificationBody({ planned, done }: Pick<ReviewTotals, "planned" | "done">) {
  if (planned === 0) return "See how your week went and plan the next one.";
  const noun = planned === 1 ? "task" : "tasks";
  return `You finished ${done} of ${planned} ${noun} this week.`;
}
