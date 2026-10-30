import { addDays, isBefore } from "@/lib/dates";
import type { EditScope } from "@/lib/recurrence-edit";
import type { DateStr, TaskScope } from "@/types/dates";
import type { Priority, TaskView } from "@/types/tasks";

// Which occurrences of a repeating task a change is for, counted from one of them.
export interface ChangeScope {
  scope: EditScope;
  occurrenceDate: DateStr;
}

// Optimistic edits to a list of tasks, applied before the server action finishes. Ticking and
// details change one occurrence (by key); renaming, priority and deleting change the whole task
// (by id), so every occurrence of a repeating task in the list follows, unless `within` limits
// them to one occurrence or the ones from it on.
export type TaskListChange =
  | { type: "toggle"; key: string; done: boolean; today: DateStr }
  | { type: "add"; task: TaskView }
  | { type: "update"; id: string; within?: ChangeScope; title?: string; priority?: Priority }
  // Saving details also ticks the task.
  | { type: "details"; key: string; minutesSpent: number | null; workNote: string | null; today: DateStr }
  | { type: "remove"; id: string; within?: ChangeScope };

const DRAFT_PREFIX = "draft:";

// One occurrence: a repeating task can appear more than once in a list with the same id.
export function taskKey(task: Pick<TaskView, "id" | "occurrenceDate">) {
  return `${task.id}@${task.occurrenceDate}`;
}

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
    occurrenceDate: day,
    done: false,
    doneLate: false,
    minutesSpent: null,
    workNote: null,
    repeats: false,
    repeatLabel: null,
  };
}

export function isDraftTask(task: TaskView) {
  return task.id.startsWith(DRAFT_PREFIX);
}

function affects(task: TaskView, id: string, within: ChangeScope | undefined) {
  if (task.id !== id) return false;
  if (!within || within.scope === "all") return true;
  return within.scope === "this"
    ? task.occurrenceDate === within.occurrenceDate
    : task.occurrenceDate >= within.occurrenceDate;
}

// Ticking keeps an existing completion's lateness; a new one is late once the occurrence has ended.
function markDone(task: TaskView, today: DateStr): TaskView {
  return { ...task, done: true, doneLate: task.done ? task.doneLate : isPastOccurrence(task, today) };
}

export function applyTaskChange(tasks: TaskView[], change: TaskListChange): TaskView[] {
  switch (change.type) {
    case "add":
      return [...tasks, change.task];
    case "remove":
      return tasks.filter((task) => !affects(task, change.id, change.within));
    case "update": {
      const { id, within, title, priority } = change;
      return tasks.map((task) =>
        affects(task, id, within)
          ? { ...task, title: title ?? task.title, priority: priority ?? task.priority }
          : task,
      );
    }
    case "toggle":
      return tasks.map((task) => {
        if (taskKey(task) !== change.key) return task;
        // Unticking deletes the completion, and its details with it.
        if (!change.done) {
          return { ...task, done: false, doneLate: false, minutesSpent: null, workNote: null };
        }
        return markDone(task, change.today);
      });
    case "details": {
      const { key, minutesSpent, workNote, today } = change;
      return tasks.map((task) => (taskKey(task) === key ? { ...markDone(task, today), minutesSpent, workNote } : task));
    }
  }
}
