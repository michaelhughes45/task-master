import { AddTaskInput } from "@/components/todos/AddTaskInput";
import { TaskRow } from "@/components/todos/TaskRow";
import type { TaskListHandlers } from "@/hooks/use-task-list";
import { countDone, isDraftTask, isMissed } from "@/lib/task-list";
import type { DateStr } from "@/types/dates";
import type { TaskView } from "@/types/tasks";

interface TaskListCardProps {
  title: string;
  subtitle?: string;
  tasks: TaskView[];
  today: DateStr;
  emptyText: string;
  addLabel: string;
  list: TaskListHandlers;
  onAdd: (title: string) => void;
}

export function TaskListCard({ title, subtitle, tasks, today, emptyText, addLabel, list, onAdd }: TaskListCardProps) {
  const { done, total } = countDone(tasks);

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
        <span className="font-mono text-[13px] text-muted-foreground" aria-label={`${done} of ${total} done`}>
          {done}/{total}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="border-t px-4 py-3.5 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              missed={isMissed(task, today)}
              disabled={isDraftTask(task)}
              onToggle={() => list.toggle(task)}
              actions={{
                onRename: (newTitle) => list.rename(task, newTitle),
                onPriorityChange: (priority) => list.setPriority(task, priority),
                onDelete: () => list.remove(task),
              }}
            />
          ))}
        </ul>
      )}

      <AddTaskInput label={addLabel} onAdd={onAdd} />
    </section>
  );
}
