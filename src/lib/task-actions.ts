import { revalidatePath } from "next/cache";
import { weekStartOf } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { DateStr, TaskScope } from "@/types/dates";

// Shared by the task, completion and occurrence actions.

export const TASK_NOT_FOUND = "That task doesn't exist or was deleted.";

export function revalidateTasks() {
  revalidatePath("/today");
  revalidatePath("/todos");
  revalidatePath("/review");
}

// Weekly tasks belong to their week's Monday.
export function normalizeTaskDate(scope: TaskScope, day: DateStr): DateStr {
  return scope === "WEEKLY" ? weekStartOf(day) : day;
}

export function findOwnedTask(id: string, userId: string) {
  return prisma.task.findFirst({
    where: { id, userId },
    select: { id: true, scope: true, date: true, rrule: true, title: true },
  });
}
