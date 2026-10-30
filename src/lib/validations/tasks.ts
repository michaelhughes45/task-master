import { z } from "zod";
import { isDateStr } from "@/lib/dates";
import { checkRepeat, rruleField } from "@/lib/validations/repeat";

export const MAX_MINUTES = 1440;

const title = z.string().trim().min(1, "Enter a title").max(200, "Use 200 characters or fewer");
const notes = z
  .string()
  .trim()
  .max(2000, "Use 2000 characters or fewer")
  .transform((value) => value || null)
  .nullable();
const priority = z.enum(["LOW", "NORMAL", "HIGH"]);
const day = z.string().refine(isDateStr, "Choose a valid date");

export const taskIdSchema = z.string().min(1).max(64);
export const occurrenceDateSchema = day;

export const createTaskSchema = z
  .object({
    title,
    scope: z.enum(["DAILY", "WEEKLY"]),
    date: day,
    priority: priority.optional(),
    notes: notes.optional(),
    rrule: rruleField,
  })
  .superRefine((task, ctx) => checkRepeat(ctx, task.rrule, task.scope, task.date));

// The rule is checked in the action, against the task's scope and (new or stored) date.
export const updateTaskSchema = z.object({
  title: title.optional(),
  priority: priority.optional(),
  notes: notes.optional(),
  date: day.optional(),
  rrule: rruleField,
});

// One field at a time from the row menu: rename, priority, or move (this occurrence only).
export const taskOccurrenceEditSchema = z.object({
  title: title.optional(),
  priority: priority.optional(),
  date: day.optional(),
});

export const completionDetailsSchema = z.object({
  minutesSpent: z
    .number()
    .int("Use whole minutes")
    .min(0, "Can't be negative")
    .max(MAX_MINUTES, "Use 24 hours (1440 minutes) or less")
    .nullable()
    .optional(),
  workNote: z
    .string()
    .trim()
    .max(500, "Use 500 characters or fewer")
    .transform((value) => value || null)
    .nullable()
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskOccurrenceEditInput = z.infer<typeof taskOccurrenceEditSchema>;
export type CompletionDetailsInput = z.infer<typeof completionDetailsSchema>;
