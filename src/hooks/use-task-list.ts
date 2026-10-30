"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { completeTask, createTask, deleteTask, uncompleteTask, updateTask } from "@/actions/tasks";
import { applyTaskChange, draftTask, type TaskListChange } from "@/lib/task-list";
import type { ActionResult } from "@/types/actions";
import type { DateStr, TaskScope } from "@/types/dates";
import type { Priority, TaskView } from "@/types/tasks";

export type TaskListHandlers = Omit<ReturnType<typeof useTaskList>, "tasks" | "add">;

// Task list state with optimistic updates. The actions revalidate the page, so the server's
// list replaces the optimistic one when they finish; a failure rolls back and shows a toast.
export function useTaskList(tasks: TaskView[], today: DateStr) {
  const [, startTransition] = useTransition();
  const [optimisticTasks, applyChange] = useOptimistic(tasks, applyTaskChange);

  function run(change: TaskListChange, action: () => Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      applyChange(change);
      const result = await action();
      if (!result.success) toast.error(result.error);
    });
  }

  return {
    tasks: optimisticTasks,
    toggle(task: TaskView) {
      const done = !task.done;
      run({ type: "toggle", id: task.id, done, today }, () =>
        done ? completeTask(task.id, task.day) : uncompleteTask(task.id, task.day),
      );
    },
    add(title: string, scope: TaskScope, day: DateStr) {
      const task = draftTask(crypto.randomUUID(), title, scope, day);
      run({ type: "add", task }, () => createTask({ title, scope, date: day }));
    },
    rename(task: TaskView, title: string) {
      run({ type: "update", id: task.id, title }, () => updateTask(task.id, { title }));
    },
    setPriority(task: TaskView, priority: Priority) {
      run({ type: "update", id: task.id, priority }, () => updateTask(task.id, { priority }));
    },
    remove(task: TaskView) {
      run({ type: "remove", id: task.id }, () => deleteTask(task.id));
    },
  };
}
