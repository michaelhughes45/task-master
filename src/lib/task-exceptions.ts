import { fromDbDate, toDbDate } from "@/lib/dates";
import type { TaskExceptionInput } from "@/lib/recurrence";
import type { Prisma } from "@/generated/prisma/client";

// A task exception as stored (`@db.Date` columns) and as the recurrence code reads it (DateStr).
export const TASK_EXCEPTION_SELECT = {
  occurrenceDate: true,
  cancelled: true,
  title: true,
  date: true,
} satisfies Prisma.TaskExceptionSelect;

type TaskExceptionRow = Prisma.TaskExceptionGetPayload<{ select: typeof TASK_EXCEPTION_SELECT }>;

export function fromDbException(e: TaskExceptionRow): TaskExceptionInput {
  return { ...e, occurrenceDate: fromDbDate(e.occurrenceDate), date: e.date && fromDbDate(e.date) };
}

export function toDbException({ occurrenceDate, cancelled, title, date }: TaskExceptionInput) {
  return { occurrenceDate: toDbDate(occurrenceDate), cancelled, title, date: date && toDbDate(date) };
}
