"use server";

import { invalid, NOT_SIGNED_IN } from "@/lib/action-helpers";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { normalizeRRule, repeatProblem } from "@/lib/rrule-builder";
import { getCurrentUserId } from "@/lib/session";
import { findOwnedTask, normalizeTaskDate, revalidateTasks, TASK_NOT_FOUND } from "@/lib/task-actions";
import { createTaskSchema, taskIdSchema, updateTaskSchema } from "@/lib/validations/tasks";
import type { ActionResult } from "@/types/actions";

// Creating, editing and deleting whole tasks. Ticking is in task-completions.ts; edits to some
// occurrences of a repeating task are in task-occurrences.ts.

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
        date: toDbDate(normalizeTaskDate(scope, date)),
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
  if (!taskId.success) return { success: false, error: TASK_NOT_FOUND };
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, rrule, ...fields } = parsed.data;

  try {
    const task = await findOwnedTask(taskId.data, userId);
    if (!task) return { success: false, error: TASK_NOT_FOUND };

    // Editing changes the whole series: the rule is checked against the series' start.
    const newDate = date === undefined ? undefined : toDbDate(normalizeTaskDate(task.scope, date));
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
  if (!taskId.success) return { success: false, error: TASK_NOT_FOUND };

  try {
    const { count } = await prisma.task.deleteMany({ where: { id: taskId.data, userId } });
    if (count === 0) return { success: false, error: TASK_NOT_FOUND };
    revalidateTasks();
    return { success: true, data: { id: taskId.data } };
  } catch (err) {
    console.error("deleteTask failed", err);
    return { success: false, error: "Couldn't delete the task. Try again." };
  }
}
