"use server";

import { invalid, NOT_SIGNED_IN } from "@/lib/action-helpers";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { planTaskDelete, planTaskEdit, type TaskPlan } from "@/lib/recurrence-edit";
import { getCurrentUserId } from "@/lib/session";
import { normalizeTaskDate, revalidateTasks, TASK_NOT_FOUND } from "@/lib/task-actions";
import { fromDbException, TASK_EXCEPTION_SELECT, toDbException } from "@/lib/task-exceptions";
import { editScopeSchema } from "@/lib/validations/repeat";
import { occurrenceDateSchema, taskIdSchema, taskOccurrenceEditSchema } from "@/lib/validations/tasks";
import type { Prisma } from "@/generated/prisma/client";
import type { ActionResult, Failure } from "@/types/actions";

const OCCURRENCE_SELECT = {
  id: true,
  scope: true,
  date: true,
  rrule: true,
  title: true,
  priority: true,
  notes: true,
  exceptions: { select: TASK_EXCEPTION_SELECT },
} satisfies Prisma.TaskSelect;

type SeriesRow = Prisma.TaskGetPayload<{ select: typeof OCCURRENCE_SELECT }>;
type Plan = Exclude<TaskPlan, { type: "error" }>;

// Shared checks for the occurrence actions: signed in, valid input, and an own repeating task,
// loaded with its exceptions. The date is normalized to the week's Monday for weekly tasks.
async function resolveSeries(id: unknown, occurrenceDate: unknown, scope: unknown) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: NOT_SIGNED_IN } satisfies Failure;
  const taskId = taskIdSchema.safeParse(id);
  if (!taskId.success) return { success: false, error: TASK_NOT_FOUND } satisfies Failure;
  const day = occurrenceDateSchema.safeParse(occurrenceDate);
  if (!day.success) return invalid(day.error);
  const editScope = editScopeSchema.safeParse(scope);
  if (!editScope.success) return invalid(editScope.error);

  const row = await prisma.task.findFirst({ where: { id: taskId.data, userId }, select: OCCURRENCE_SELECT });
  if (!row) return { success: false, error: TASK_NOT_FOUND } satisfies Failure;
  if (!row.rrule) return { success: false, error: "That task doesn't repeat." } satisfies Failure;
  return {
    success: true as const,
    userId,
    row,
    scope: editScope.data,
    occurrence: normalizeTaskDate(row.scope, day.data),
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
