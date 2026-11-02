"use server";

import { invalid, NOT_SIGNED_IN } from "@/lib/action-helpers";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { isTaskOccurrence } from "@/lib/recurrence";
import { getCurrentUserId } from "@/lib/session";
import { findOwnedTask, normalizeTaskDate, revalidateTasks, TASK_NOT_FOUND } from "@/lib/task-actions";
import { fromDbException, TASK_EXCEPTION_SELECT } from "@/lib/task-exceptions";
import { completionDetailsSchema, occurrenceDateSchema, taskIdSchema } from "@/lib/validations/tasks";
import type { ActionResult, Failure } from "@/types/actions";

const NOT_AN_OCCURRENCE = "That task isn't planned for that date.";

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
  if (!id.success) return { success: false, error: TASK_NOT_FOUND };
  const day = occurrenceDateSchema.safeParse(occurrenceDate);
  if (!day.success) return invalid(day.error);

  const task = await findOwnedTask(id.data, userId);
  if (!task) return { success: false, error: TASK_NOT_FOUND };

  const occurrence = normalizeTaskDate(task.scope, day.data);
  const exceptions = await prisma.taskException.findMany({
    where: { taskId: task.id, occurrenceDate: toDbDate(occurrence) },
    select: TASK_EXCEPTION_SELECT,
  });
  const series = { ...task, date: fromDbDate(task.date) };
  if (!isTaskOccurrence(series, exceptions.map(fromDbException), occurrence)) {
    return { success: false, error: NOT_AN_OCCURRENCE };
  }
  return { success: true, taskId: task.id, occurrence: toDbDate(occurrence) };
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
