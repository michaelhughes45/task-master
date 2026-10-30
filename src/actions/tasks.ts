"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromDbDate, toDbDate, weekStartOf } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { isTaskOccurrence } from "@/lib/recurrence";
import { getCurrentUserId } from "@/lib/session";
import {
  completionDetailsSchema,
  createTaskSchema,
  occurrenceDateSchema,
  taskIdSchema,
  updateTaskSchema,
} from "@/lib/validations/tasks";
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
  const { title, scope, date, priority, notes } = parsed.data;

  try {
    const task = await prisma.task.create({
      data: { userId, title, scope, priority, notes, date: toDbDate(normalizeDate(scope, date)) },
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
  const { date, ...fields } = parsed.data;

  try {
    const task = await findOwnedTask(taskId.data, userId);
    if (!task) return { success: false, error: NOT_FOUND };

    const newDate = date === undefined ? undefined : toDbDate(normalizeDate(task.scope, date));
    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id, userId }, data: { ...fields, date: newDate } }),
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
