import type { Priority } from "@/generated/prisma/enums";
import type { DateStr, TaskScope } from "@/types/dates";

export type { Priority };

// One task occurrence as pages see it. `day` is the day it's shown on (daily) or its week's
// Monday (weekly); `occurrenceDate` is the date the series produced, which completions are
// keyed by. They differ only for an occurrence moved to another day.
export interface TaskView {
  id: string;
  title: string;
  notes: string | null;
  scope: TaskScope;
  priority: Priority;
  day: DateStr;
  occurrenceDate: DateStr;
  done: boolean;
  doneLate: boolean;
  minutesSpent: number | null;
  workNote: string | null;
  // Part of a repeating series: changes ask which occurrences they're for.
  repeats: boolean;
  // "Repeats daily"; null for a one-off task.
  repeatLabel: string | null;
}

// Daily tasks done / planned on one day, for the week strip.
export interface DayCount {
  day: DateStr;
  done: number;
  total: number;
}
