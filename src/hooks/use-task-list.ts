"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  completeTask,
  createTask,
  deleteTask,
  deleteTaskOccurrence,
  saveCompletionDetails,
  uncompleteTask,
  updateTask,
  updateTaskOccurrence,
} from "@/actions/tasks";
import type { EditScope } from "@/lib/recurrence-edit";
import { applyTaskChange, draftTask, taskKey, type TaskListChange } from "@/lib/task-list";
import type { TaskOccurrenceEditInput } from "@/lib/validations/tasks";
import type { ActionResult } from "@/types/actions";
import type { DateStr, TaskScope } from "@/types/dates";
import type { Priority, TaskView } from "@/types/tasks";

export interface CompletionDetails {
  minutesSpent: number | null;
  workNote: string | null;
}

export type TaskListHandlers = Omit<ReturnType<typeof useTaskList>, "tasks" | "add">;

// Task list state with optimistic updates. The actions revalidate the page, so the server's
// list replaces the optimistic one when they finish; a failure rolls back and shows a toast.
export function useTaskList(tasks: TaskView[], today: DateStr) {
  const [, startTransition] = useTransition();
  const [optimisticTasks, applyChange] = useOptimistic(tasks, applyTaskChange);

  function run(change: TaskListChange, action: () => Promise<ActionResult<unknown>>, onSuccess?: () => void) {
    startTransition(async () => {
      applyChange(change);
      const result = await action();
      if (!result.success) toast.error(result.error);
      else onSuccess?.();
    });
  }

  // A repeating task changes by scope from this occurrence; a one-off task (no scope) as a whole.
  function edit(task: TaskView, scope: EditScope | undefined, input: TaskOccurrenceEditInput) {
    const within = scope && { scope, occurrenceDate: task.occurrenceDate };
    run({ type: "update", id: task.id, within, ...input }, () =>
      scope ? updateTaskOccurrence(task.id, task.occurrenceDate, scope, input) : updateTask(task.id, input),
    );
  }

  function saveDetails(task: TaskView, details: CompletionDetails) {
    run({ type: "details", key: taskKey(task), ...details, today }, () =>
      saveCompletionDetails(task.id, task.occurrenceDate, details),
    );
  }

  return {
    tasks: optimisticTasks,
    toggle(task: TaskView) {
      const done = !task.done;
      if (done) {
        run({ type: "toggle", key: taskKey(task), done, today }, () => completeTask(task.id, task.occurrenceDate));
        return;
      }
      // Unticking deletes the completion with its details, so offer them back.
      const { minutesSpent, workNote } = task;
      const hadDetails = minutesSpent !== null || workNote !== null;
      run(
        { type: "toggle", key: taskKey(task), done, today },
        () => uncompleteTask(task.id, task.occurrenceDate),
        hadDetails
          ? () =>
              toast(`Unticked ${task.title}`, {
                description: "Its time spent and notes were cleared.",
                duration: 8000,
                action: { label: "Undo", onClick: () => saveDetails(task, { minutesSpent, workNote }) },
              })
          : undefined,
      );
    },
    saveDetails,
    add(title: string, scope: TaskScope, day: DateStr) {
      const task = draftTask(crypto.randomUUID(), title, scope, day);
      run({ type: "add", task }, () => createTask({ title, scope, date: day }));
    },
    rename(task: TaskView, title: string, scope?: EditScope) {
      edit(task, scope, { title });
    },
    setPriority(task: TaskView, priority: Priority, scope?: EditScope) {
      edit(task, scope, { priority });
    },
    remove(task: TaskView, scope?: EditScope) {
      run({ type: "remove", id: task.id, within: scope && { scope, occurrenceDate: task.occurrenceDate } }, () =>
        scope ? deleteTaskOccurrence(task.id, task.occurrenceDate, scope) : deleteTask(task.id),
      );
    },
    // Moves a daily task to another day: one occurrence of a repeating task, or a one-off task
    // (with its completion). It leaves this day's list.
    move(task: TaskView, date: DateStr) {
      run({ type: "remove", id: task.id, within: { scope: "this", occurrenceDate: task.occurrenceDate } }, () =>
        task.repeats ? updateTaskOccurrence(task.id, task.occurrenceDate, "this", { date }) : updateTask(task.id, { date }),
      );
    },
  };
}
