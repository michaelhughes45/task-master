import type { DateStr, TaskScope } from "@/types/dates";

export interface ReviewCompletion {
  completedAt: Date;
  minutesSpent: number | null;
  workNote: string | null;
}

// One planned task occurrence (cancelled ones already left out), as the review reads it.
export interface ReviewOccurrence {
  taskId: string;
  title: string;
  scope: TaskScope;
  // The day it's shown on (daily) or its week's Monday (weekly).
  day: DateStr;
  // Part of a repeating series.
  repeats: boolean;
  completion: ReviewCompletion | null;
}

export interface WeeklyReviewInput {
  weekStart: DateStr;
  occurrences: ReviewOccurrence[];
  // The week before; null when it wasn't loaded.
  previous: ReviewOccurrence[] | null;
  // Today in the user's zone: occurrences that aren't over yet are open, not missed.
  today: DateStr;
  tz: string;
}

export interface ReviewRate {
  planned: number;
  done: number;
  // Whole percent; null when nothing was planned.
  rate: number | null;
}

export interface ReviewTotals extends ReviewRate {
  doneLate: number;
  missed: number;
  // Planned, not done, and its day (or week) isn't over yet.
  open: number;
}

export interface ReviewTaskItem {
  taskId: string;
  title: string;
  scope: TaskScope;
  day: DateStr;
}

export interface ReviewDoneItem extends ReviewTaskItem {
  late: boolean;
  minutesSpent: number | null;
}

export interface ReviewTaskTime {
  taskId: string;
  title: string;
  minutes: number;
}

export interface ReviewDay {
  day: DateStr;
  planned: number;
  done: number;
}

export interface ReviewMissedTask {
  taskId: string;
  title: string;
  scope: TaskScope;
  missed: number;
  planned: number;
}

export interface ReviewNote {
  // The day it was for; weekly tasks use the day ticked, kept within the week.
  day: DateStr;
  taskId: string;
  title: string;
  scope: TaskScope;
  minutesSpent: number | null;
  note: string;
}

export interface ReviewComparison {
  previousRate: number | null;
  // Percentage points; null when either week has nothing planned.
  rateChange: number | null;
  previousMinutes: number;
  minutesChange: number;
}

export interface WeeklyReview {
  weekStart: DateStr;
  totals: ReviewTotals;
  daily: ReviewRate;
  weekly: ReviewRate;
  // Both in date order, then list order.
  done: ReviewDoneItem[];
  missed: ReviewTaskItem[];
  minutesTracked: number;
  // Most time first, top 5.
  timeByTask: ReviewTaskTime[];
  // Daily tasks only, Monday to Sunday.
  perDay: ReviewDay[];
  // Repeating tasks with at least one miss: most misses, then highest share missed, top 3.
  mostMissed: ReviewMissedTask[];
  notes: ReviewNote[];
  // null when the previous week had nothing planned (or wasn't loaded).
  comparison: ReviewComparison | null;
}
