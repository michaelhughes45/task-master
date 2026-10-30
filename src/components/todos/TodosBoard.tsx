"use client";

import { TaskListCard } from "@/components/todos/TaskListCard";
import { WeekStrip, type WeekStripDay } from "@/components/todos/WeekStrip";
import { useTaskList } from "@/hooks/use-task-list";
import { countDone } from "@/lib/task-list";
import type { DateStr } from "@/types/dates";
import type { TaskView } from "@/types/tasks";

interface CardLabels {
  title: string;
  subtitle?: string;
  addLabel: string;
}

interface TodosBoardProps {
  day: DateStr;
  weekStart: DateStr;
  today: DateStr;
  // The selected day's daily tasks and the week's weekly tasks.
  tasks: TaskView[];
  stripDays: WeekStripDay[];
  dayLabels: CardLabels;
  weekLabels: CardLabels;
  isPastDay: boolean;
}

// Owns the optimistic task list so a tick updates the row, the card count and the strip at once.
export function TodosBoard({ day, weekStart, today, tasks, stripDays, dayLabels, weekLabels, isPastDay }: TodosBoardProps) {
  const { tasks: optimisticTasks, add, ...handlers } = useTaskList(tasks, today);
  const dayTasks = optimisticTasks.filter((task) => task.scope === "DAILY");
  const weekTasks = optimisticTasks.filter((task) => task.scope === "WEEKLY");
  const days = stripDays.map((d) => (d.day === day ? { ...d, ...countDone(dayTasks) } : d));

  return (
    <div className="flex flex-col gap-5">
      <WeekStrip days={days} selected={day} />
      {isPastDay && (
        <p className="text-[13.5px] text-muted-foreground">
          Unfinished tasks stay on their day and count as missed in the weekly review. If you did one and
          forgot to tick it, you can still mark it done. It will show as done late.
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(330px,100%),1fr))] items-start gap-6">
        <TaskListCard
          title={dayLabels.title}
          subtitle={dayLabels.subtitle}
          tasks={dayTasks}
          today={today}
          emptyText="Nothing planned for this day."
          list={handlers}
          add={{ label: dayLabels.addLabel, onAdd: (title) => add(title, "DAILY", day) }}
        />
        <TaskListCard
          title={weekLabels.title}
          subtitle={weekLabels.subtitle}
          tasks={weekTasks}
          today={today}
          emptyText="No weekly tasks yet."
          list={handlers}
          add={{ label: weekLabels.addLabel, onAdd: (title) => add(title, "WEEKLY", weekStart) }}
        />
      </div>
    </div>
  );
}
