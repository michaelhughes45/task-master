"use client";

import { useState } from "react";
import { AddTaskInput } from "@/components/todos/AddTaskInput";
import { TaskRow } from "@/components/todos/TaskRow";
import type { TaskListHandlers } from "@/hooks/use-task-list";
import { formatDayShort } from "@/lib/dates";
import { countDone, isDraftTask, isMissed, taskKey } from "@/lib/task-list";
import type { DateStr } from "@/types/dates";
import type { TaskView } from "@/types/tasks";

interface TaskListCardProps {
  title: string;
  subtitle?: string;
  tasks: TaskView[];
  today: DateStr;
  emptyText: string;
  list: TaskListHandlers;
  // Shows the inline add field when given.
  add?: { label: string; onAdd: (title: string) => void };
  // Replaces the "done/total" count.
  countLabel?: string;
  // Tags each row with its day, for lists that mix days.
  showDay?: boolean;
}

// The details panel open in this list, if any (by taskKey). Only one at a time.
interface OpenDetails {
  key: string;
  autoFocus: boolean;
}

export function TaskListCard({
  title,
  subtitle,
  tasks,
  today,
  emptyText,
  list,
  add,
  countLabel,
  showDay,
}: TaskListCardProps) {
  const { done, total } = countDone(tasks);
  const [openDetails, setOpenDetails] = useState<OpenDetails | null>(null);

  // Ticking opens the details prompt; unticking closes it.
  function toggle(task: TaskView) {
    const key = taskKey(task);
    setOpenDetails(task.done ? (prev) => (prev?.key === key ? null : prev) : { key, autoFocus: false });
    list.toggle(task);
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-3">
        <h2 className="text-[15px] font-semibold">
          {title}
          {subtitle && (
            <>
              {" "}
              <span className="ml-1 text-[13.5px] font-normal text-muted-foreground">{subtitle}</span>
            </>
          )}
        </h2>
        {countLabel ? (
          <span className="font-mono text-[13px] text-muted-foreground">{countLabel}</span>
        ) : (
          <span className="font-mono text-[13px] text-muted-foreground" aria-label={`${done} of ${total} done`}>
            {done}/{total}
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="border-t px-4 py-3.5 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <TaskRow
              key={taskKey(task)}
              task={task}
              missed={isMissed(task, today)}
              disabled={isDraftTask(task)}
              dayLabel={showDay ? formatDayShort(task.day) : undefined}
              onToggle={() => toggle(task)}
              actions={{
                onRename: (newTitle, scope) => list.rename(task, newTitle, scope),
                onPriorityChange: (priority, scope) => list.setPriority(task, priority, scope),
                onDelete: (scope) => list.remove(task, scope),
                onMove: task.scope === "DAILY" ? (date) => list.move(task, date) : undefined,
              }}
              details={{
                open: openDetails?.key === taskKey(task),
                autoFocus: openDetails?.autoFocus ?? false,
                onToggle: () =>
                  setOpenDetails((prev) =>
                    prev?.key === taskKey(task) ? null : { key: taskKey(task), autoFocus: true },
                  ),
                onClose: () => setOpenDetails(null),
                onSave: (details) => list.saveDetails(task, details),
              }}
            />
          ))}
        </ul>
      )}

      {add && <AddTaskInput label={add.label} onAdd={add.onAdd} />}
    </section>
  );
}
