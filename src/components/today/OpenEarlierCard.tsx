"use client";

import { TaskListCard } from "@/components/todos/TaskListCard";
import type { TaskListHandlers } from "@/hooks/use-task-list";
import type { DateStr } from "@/types/dates";
import type { TaskView } from "@/types/tasks";

interface OpenEarlierCardProps {
  // This week's earlier daily tasks not done, plus ones ticked off (late) today.
  tasks: TaskView[];
  today: DateStr;
  list: TaskListHandlers;
}

// Each row tagged with its day, with "Mark done" for the missed ones. Hidden when empty.
export function OpenEarlierCard({ tasks, today, list }: OpenEarlierCardProps) {
  if (tasks.length === 0) return null;
  const open = tasks.filter((task) => !task.done).length;

  return (
    <TaskListCard
      title="Still open from earlier"
      subtitle="this week"
      tasks={tasks}
      today={today}
      emptyText=""
      list={list}
      countLabel={`${open} open`}
      showDay
    />
  );
}
