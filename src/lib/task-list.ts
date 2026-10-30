import { addDays, isBefore } from "@/lib/dates";
import type { DateStr, TaskScope } from "@/types/dates";
import type { Priority, TaskView } from "@/types/tasks";

// Optimistic edits to a list of tasks, applied before the server action finishes.
export type TaskListChange =
  | { type: "toggle"; id: string; done: boolean; today: DateStr }
  | { type: "add"; task: TaskView }
  | { type: "update"; id: string; title?: string; priority?: Priority }
  | { type: "remove"; id: string };

const DRAFT_PREFIX = "draft:";

// A task's day or week has ended. Weekly tasks run until their Sunday.
export function isPastOccurrence(task: { scope: TaskScope; day: DateStr }, today: DateStr) {
  const lastDay = task.scope === "WEEKLY" ? addDays(task.day, 6) : task.day;
  return isBefore(lastDay, today);
}

export function isMissed(task: TaskView, today: DateStr) {
  return !task.done && isPastOccurrence(task, today);
}

export function countDone(tasks: TaskView[]) {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

// A placeholder row shown while createTask runs; replaced by the real task on revalidation.
export function draftTask(id: string, title: string, scope: TaskScope, day: DateStr): TaskView {
  return {
    id: DRAFT_PREFIX + id,
    title,
    notes: null,
    scope,
    priority: "NORMAL",
    day,
    done: false,
    doneLate: false,
    minutesSpent: null,
    workNote: null,
  };
}

export function isDraftTask(task: TaskView) {
  return task.id.startsWith(DRAFT_PREFIX);
}

export function applyTaskChange(tasks: TaskView[], change: TaskListChange): TaskView[] {
  switch (change.type) {
    case "add":
      return [...tasks, change.task];
    case "remove":
      return tasks.filter((task) => task.id !== change.id);
    case "update": {
      const { id, title, priority } = change;
      return tasks.map((task) =>
        task.id === id
          ? { ...task, title: title ?? task.title, priority: priority ?? task.priority }
          : task,
      );
    }
    case "toggle":
      return tasks.map((task) => {
        if (task.id !== change.id) return task;
        // Unticking deletes the completion, and its details with it.
        if (!change.done) {
          return { ...task, done: false, doneLate: false, minutesSpent: null, workNote: null };
        }
        return { ...task, done: true, doneLate: task.done ? task.doneLate : isPastOccurrence(task, change.today) };
      });
  }
}
