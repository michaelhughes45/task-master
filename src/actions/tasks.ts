"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromDbDate, toDbDate, weekStartOf } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { isTaskOccurrence, type TaskExceptionInput } from "@/lib/recurrence";
import { planTaskDelete, planTaskEdit, type TaskPlan } from "@/lib/recurrence-edit";
import { normalizeRRule, repeatProblem } from "@/lib/rrule-builder";
import { getCurrentUserId } from "@/lib/session";
import { editScopeSchema } from "@/lib/validations/repeat";
import {
  completionDetailsSchema,
  createTaskSchema,
  occurrenceDateSchema,
  taskIdSchema,
  taskOccurrenceEditSchema,
  updateTaskSchema,
} from "@/lib/validations/tasks";
import type { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/types/actions";
import type { DateStr, TaskScope } from "@/types/dates";

const NOT_SIGNED_IN = "You're signed out. Sign in and try again.";
const NOT_FOUND = "That task doesn't exist or was deleted.";
const NOT_AN_OCCURRENCE = "That task isn't planned for that date.";

type Failure = Extract<ActionResult<never>, { success: false }>;

function revalidateTasks() {
  revalidatePath("/today");
  revalidatePath("/todos");
  revalidatePath("/review");
}

function invalid(error: z.ZodError): Failure {
  const { fieldErrors } = z.flattenError(error);
  return {
    success: false,
    error: error.issues[0].message,
    fieldErrors: fieldErrors as Record<string, string[]>,
  };
}

// Weekly tasks belong to their week's Monday.
function normalizeDate(scope: TaskScope, day: DateStr): DateStr {
  return scope === "WEEKLY" ? weekStartOf(day) : day;
}

function findOwnedTask(id: string, userId: string) {
  return prisma.task.findFirst({
    where: { id, userId },
    select: { id: true, scope: true, date: true, rrule: true, title: true },
  });
}

// Shared checks for the completion actions: signed in, valid input, own task, and a date the
// task is actually planned for (its own day or week, or an occurrence of its series that
// wasn't cancelled).
async function resolveOccurrence(
  taskId: unknown,
  occurrenceDate: unknown,
): Promise<Failure | { success: true; taskId: string; occurrence: Date }> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const id = taskIdSchema.safeParse(taskId);
  if (!id.success) return { success: false, error: NOT_FOUND };
  const day = occurrenceDateSchema.safeParse(occurrenceDate);
  if (!day.success) return invalid(day.error);

  const task = await findOwnedTask(id.data, userId);
  if (!task) return { success: false, error: NOT_FOUND };

  const occurrence = normalizeDate(task.scope, day.data);
  const exceptions = await prisma.taskException.findMany({
    where: { taskId: task.id, occurrenceDate: toDbDate(occurrence) },
    select: { occurrenceDate: true, cancelled: true, title: true, date: true },
  });
  const series = { ...task, date: fromDbDate(task.date) };
  const known = exceptions.map((e) => ({
    ...e,
    occurrenceDate: fromDbDate(e.occurrenceDate),
    date: e.date && fromDbDate(e.date),
  }));
  if (!isTaskOccurrence(series, known, occurrence)) return { success: false, error: NOT_AN_OCCURRENCE };
  return { success: true, taskId: task.id, occurrence: toDbDate(occurrence) };
}

export async function createTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { title, scope, date, priority, notes, rrule } = parsed.data;

  try {
    const task = await prisma.task.create({
      data: {
        userId,
        title,
        scope,
        priority,
        notes,
        date: toDbDate(normalizeDate(scope, date)),
        rrule: rrule ? normalizeRRule(rrule) : null,
      },
      select: { id: true },
    });
    revalidateTasks();
    return { success: true, data: task };
  } catch (err) {
    console.error("createTask failed", err);
    return { success: false, error: "Couldn't add the task. Try again." };
  }
}

export async function updateTask(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const taskId = taskIdSchema.safeParse(id);
  if (!taskId.success) return { success: false, error: NOT_FOUND };
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, rrule, ...fields } = parsed.data;

  try {
    const task = await findOwnedTask(taskId.data, userId);
    if (!task) return { success: false, error: NOT_FOUND };

    // Editing changes the whole series: the rule is checked against the series' start.
    const newDate = date === undefined ? undefined : toDbDate(normalizeDate(task.scope, date));
    const newRule = rrule === undefined ? undefined : rrule ? normalizeRRule(rrule) : null;
    const problem = rrule && repeatProblem(rrule, task.scope, fromDbDate(newDate ?? task.date));
    if (problem) return { success: false, error: problem, fieldErrors: { rrule: [problem] } };

    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id, userId },
        data: { ...fields, date: newDate, rrule: newRule },
      }),
      // A one-off task's completion is for its own date, so it moves with the task. A series'
      // completions stay on the dates they were for.
      ...(newDate && task.rrule === null
        ? [prisma.taskCompletion.updateMany({ where: { taskId: task.id }, data: { occurrenceDate: newDate } })]
        : []),
    ]);
    revalidateTasks();
    return { success: true, data: { id: task.id } };
  } catch (err) {
    console.error("updateTask failed", err);
    return { success: false, error: "Couldn't save the task. Try again." };
  }
}

export async function deleteTask(id: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN };

  const taskId = taskIdSchema.safeParse(id);
  if (!taskId.success) return { success: false, error: NOT_FOUND };

  try {
    const { count } = await prisma.task.deleteMany({ where: { id: taskId.data, userId } });
    if (count === 0) return { success: false, error: NOT_FOUND };
    revalidateTasks();
    return { success: true, data: { id: taskId.data } };
  } catch (err) {
    console.error("deleteTask failed", err);
    return { success: false, error: "Couldn't delete the task. Try again." };
  }
}

const OCCURRENCE_SELECT = {
  id: true,
  scope: true,
  date: true,
  rrule: true,
  title: true,
  priority: true,
  notes: true,
  exceptions: { select: { occurrenceDate: true, cancelled: true, title: true, date: true } },
} satisfies Prisma.TaskSelect;

type SeriesRow = Prisma.TaskGetPayload<{ select: typeof OCCURRENCE_SELECT }>;
type Plan = Exclude<TaskPlan, { type: "error" }>;

function fromDbException(e: SeriesRow["exceptions"][number]): TaskExceptionInput {
  return { ...e, occurrenceDate: fromDbDate(e.occurrenceDate), date: e.date && fromDbDate(e.date) };
}

function toDbException({ occurrenceDate, cancelled, title, date }: TaskExceptionInput) {
  return { occurrenceDate: toDbDate(occurrenceDate), cancelled, title, date: date && toDbDate(date) };
}

// Shared checks for the occurrence actions: signed in, valid input, and an own repeating task,
// loaded with its exceptions. The date is normalized to the week's Monday for weekly tasks.
async function resolveSeries(id: unknown, occurrenceDate: unknown, scope: unknown) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN } satisfies Failure;
  const taskId = taskIdSchema.safeParse(id);
  if (!taskId.success) return { success: false, error: NOT_FOUND } satisfies Failure;
  const day = occurrenceDateSchema.safeParse(occurrenceDate);
  if (!day.success) return invalid(day.error);
  const editScope = editScopeSchema.safeParse(scope);
  if (!editScope.success) return invalid(editScope.error);

  const row = await prisma.task.findFirst({ where: { id: taskId.data, userId }, select: OCCURRENCE_SELECT });
  if (!row) return { success: false, error: NOT_FOUND } satisfies Failure;
  if (!row.rrule) return { success: false, error: "That task doesn't repeat." } satisfies Failure;
  return {
    success: true as const,
    userId,
    row,
    scope: editScope.data,
    occurrence: normalizeDate(row.scope, day.data),
    series: { ...row, rrule: row.rrule, date: fromDbDate(row.date) },
    exceptions: row.exceptions.map(fromDbException),
  };
}

// Writes a plan in one transaction. Completions stay keyed by the date they were for.
async function runPlan(plan: Plan, row: SeriesRow, userId: string) {
  const taskId = row.id;
  await prisma.$transaction(async (tx) => {
    switch (plan.type) {
      case "exception": {
        const { occurrenceDate, ...fields } = toDbException(plan.row);
        await tx.taskException.upsert({
          where: { taskId_occurrenceDate: { taskId, occurrenceDate } },
          create: { taskId, occurrenceDate, ...fields },
          update: fields,
        });
        // A cancelled occurrence isn't planned, so it can't stay done.
        if (fields.cancelled) await tx.taskCompletion.deleteMany({ where: { taskId, occurrenceDate } });
        return;
      }
      case "update":
        await tx.task.update({ where: { id: taskId, userId }, data: plan.data });
        if (plan.exceptions) {
          await tx.taskException.deleteMany({ where: { taskId } });
          await tx.taskException.createMany({ data: plan.exceptions.map((e) => ({ taskId, ...toDbException(e) })) });
        }
        return;
      case "split": {
        const from = toDbDate(plan.from);
        await tx.task.update({ where: { id: taskId, userId }, data: { rrule: plan.rule } });
        const next = await tx.task.create({
          data: {
            userId,
            scope: row.scope,
            notes: row.notes,
            ...plan.next,
            date: toDbDate(plan.next.date),
            exceptions: { create: plan.exceptions.map(toDbException) },
          },
          select: { id: true },
        });
        await tx.taskException.deleteMany({ where: { taskId, occurrenceDate: { gte: from } } });
        await tx.taskCompletion.updateMany({
          where: { taskId, occurrenceDate: { in: plan.completions.map(toDbDate) } },
          data: { taskId: next.id },
        });
        await tx.taskCompletion.deleteMany({ where: { taskId, occurrenceDate: { gte: from } } });
        return;
      }
      case "end": {
        const from = toDbDate(plan.from);
        await tx.task.update({ where: { id: taskId, userId }, data: { rrule: plan.rule } });
        await tx.taskException.deleteMany({ where: { taskId, occurrenceDate: { gte: from } } });
        await tx.taskCompletion.deleteMany({ where: { taskId, occurrenceDate: { gte: from } } });
        return;
      }
      case "delete":
        await tx.task.deleteMany({ where: { id: taskId, userId } });
    }
  });
}

// Renames, reprioritizes or moves one occurrence of a repeating task, this and the following
// ones, or all of them.
export async function updateTaskOccurrence(
  id: unknown,
  occurrenceDate: unknown,
  scope: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const target = await resolveSeries(id, occurrenceDate, scope);
    if (!target.success) return target;
    const parsed = taskOccurrenceEditSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const completions =
      target.scope === "following"
        ? await prisma.taskCompletion.findMany({
            where: { taskId: target.row.id, occurrenceDate: { gte: toDbDate(target.occurrence) } },
            select: { occurrenceDate: true },
          })
        : [];
    const plan = planTaskEdit(
      target.series,
      target.exceptions,
      completions.map((c) => fromDbDate(c.occurrenceDate)),
      target.occurrence,
      target.scope,
      parsed.data,
    );
    if (plan.type === "error") return { success: false, error: plan.error };

    await runPlan(plan, target.row, target.userId);
    revalidateTasks();
    return { success: true, data: { id: target.row.id } };
  } catch (err) {
    console.error("updateTaskOccurrence failed", err);
    return { success: false, error: "Couldn't save the task. Try again." };
  }
}

export async function deleteTaskOccurrence(
  id: unknown,
  occurrenceDate: unknown,
  scope: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const target = await resolveSeries(id, occurrenceDate, scope);
    if (!target.success) return target;

    const plan = planTaskDelete(target.series, target.exceptions, target.occurrence, target.scope);
    if (plan.type === "error") return { success: false, error: plan.error };

    await runPlan(plan, target.row, target.userId);
    revalidateTasks();
    return { success: true, data: { id: target.row.id } };
  } catch (err) {
    console.error("deleteTaskOccurrence failed", err);
    return { success: false, error: "Couldn't delete the task. Try again." };
  }
}

// Ticking an already-ticked task keeps the original completedAt, so a double tap can't turn
// an on-time completion into a late one.
export async function completeTask(
  taskId: unknown,
  occurrenceDate: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  try {
    const target = await resolveOccurrence(taskId, occurrenceDate);
    if (!target.success) return target;

    await prisma.taskCompletion.upsert({
      where: { taskId_occurrenceDate: { taskId: target.taskId, occurrenceDate: target.occurrence } },
      create: { taskId: target.taskId, occurrenceDate: target.occurrence, completedAt: new Date() },
      update: {},
    });
    revalidateTasks();
    return { success: true, data: { taskId: target.taskId } };
  } catch (err) {
    console.error("completeTask failed", err);
    return { success: false, error: "Couldn't mark the task done. Try again." };
  }
}

export async function uncompleteTask(
  taskId: unknown,
  occurrenceDate: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  try {
    const target = await resolveOccurrence(taskId, occurrenceDate);
    if (!target.success) return target;

    await prisma.taskCompletion.deleteMany({
      where: { taskId: target.taskId, occurrenceDate: target.occurrence },
    });
    revalidateTasks();
    return { success: true, data: { taskId: target.taskId } };
  } catch (err) {
    console.error("uncompleteTask failed", err);
    return { success: false, error: "Couldn't mark the task not done. Try again." };
  }
}

// Saving details also ticks the task, like the mockup's "Save" in the completion prompt.
export async function saveCompletionDetails(
  taskId: unknown,
  occurrenceDate: unknown,
  input: unknown,
): Promise<ActionResult<{ minutesSpent: number | null; workNote: string | null }>> {
  try {
    const target = await resolveOccurrence(taskId, occurrenceDate);
    if (!target.success) return target;
    const parsed = completionDetailsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const completion = await prisma.taskCompletion.upsert({
      where: { taskId_occurrenceDate: { taskId: target.taskId, occurrenceDate: target.occurrence } },
      create: {
        taskId: target.taskId,
        occurrenceDate: target.occurrence,
        completedAt: new Date(),
        ...parsed.data,
      },
      update: parsed.data,
      select: { minutesSpent: true, workNote: true },
    });
    revalidateTasks();
    return { success: true, data: completion };
  } catch (err) {
    console.error("saveCompletionDetails failed", err);
    return { success: false, error: "Couldn't save the details. Try again." };
  }
}
