import type { Priority } from "@/generated/prisma/enums";
import type { DateStr, TaskScope } from "@/types/dates";

export type { Priority };

// One task occurrence as pages see it. `day` is the task's day (daily) or its week's Monday (weekly).
export interface TaskView {
  id: string;
  title: string;
  notes: string | null;
  scope: TaskScope;
  priority: Priority;
  day: DateStr;
  done: boolean;
  doneLate: boolean;
  minutesSpent: number | null;
  workNote: string | null;
}

// Daily tasks done / planned on one day, for the week strip.
export interface DayCount {
  day: DateStr;
  done: number;
  total: number;
}
