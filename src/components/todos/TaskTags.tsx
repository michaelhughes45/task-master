import { formatMinutes } from "@/lib/dates";
import type { TaskView } from "@/types/tasks";

// The small tags under a task's title: day, missed / late, priority, repeat and time spent.
export function TaskTags({ task, missed, dayLabel }: { task: TaskView; missed: boolean; dayLabel?: string }) {
  const minutes = task.done && task.minutesSpent ? task.minutesSpent : null;
  if (!dayLabel && !missed && !task.doneLate && task.priority !== "HIGH" && minutes === null && !task.repeatLabel) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
      {dayLabel && <span className="text-foreground">{dayLabel}</span>}
      {missed && <span className="font-medium text-warning">Missed</span>}
      {task.doneLate && <span className="font-medium text-warning">Done late</span>}
      {task.priority === "HIGH" && <span className="font-medium text-primary-text">High priority</span>}
      {task.repeatLabel && <span>{task.repeatLabel}</span>}
      {minutes !== null && (
        <span className="font-mono text-[12.5px] text-success-ink">{formatMinutes(minutes)}</span>
      )}
    </div>
  );
}
