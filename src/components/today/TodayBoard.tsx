"use client";

import Link from "next/link";
import { NowCard } from "@/components/today/NowCard";
import { OpenEarlierCard } from "@/components/today/OpenEarlierCard";
import { ScheduleCard } from "@/components/today/ScheduleCard";
import { SummaryLine } from "@/components/today/SummaryLine";
import { TaskListCard } from "@/components/todos/TaskListCard";
import { useCurrentMinute } from "@/hooks/use-current-minute";
import { useTaskList } from "@/hooks/use-task-list";
import { todayIn } from "@/lib/dates";
import { countDone } from "@/lib/task-list";
import { missedSummary, type ScheduleItem } from "@/lib/today";
import type { DateStr } from "@/types/dates";
import type { TaskView } from "@/types/tasks";

interface TodayBoardProps {
  today: DateStr;
  weekStart: DateStr;
  tz: string;
  // When the server rendered, so hydration shows the same past / now events.
  serverNow: number;
  // Today's daily tasks, this week's weekly tasks and earlier days' open (or ticked today) ones.
  tasks: TaskView[];
  schedule: ScheduleItem[];
  labels: { day: string; week: string };
}

// Owns the optimistic task list so a tick updates the row, the card counts and the summary at once.
export function TodayBoard({ today, weekStart, tz, serverNow, tasks, schedule, labels }: TodayBoardProps) {
  const { tasks: optimisticTasks, add, ...handlers } = useTaskList(tasks, today);
  const now = useCurrentMinute(serverNow);
  const dayTasks = optimisticTasks.filter((task) => task.scope === "DAILY" && task.day === today);
  const weekTasks = optimisticTasks.filter((task) => task.scope === "WEEKLY");
  const earlierTasks = optimisticTasks.filter((task) => task.scope === "DAILY" && task.day < today);
  // The page may have stayed open past midnight.
  const dayOver = now !== null && todayIn(tz, new Date(now)) !== today;

  return (
    <div className="flex flex-col gap-5">
      <SummaryLine dayTasks={dayTasks} weekTasks={weekTasks} eventCount={schedule.length} />
      {now !== null && !dayOver && <NowCard items={schedule} now={now} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(330px,100%),1fr))] items-start gap-6">
        <ScheduleCard items={schedule} now={now} />
        <div className="flex min-w-0 flex-col gap-6">
          <TaskListCard
            title="Today"
            subtitle={labels.day}
            tasks={dayTasks}
            today={today}
            emptyText="Nothing planned for today."
            list={handlers}
            add={{ label: "Add a task for today", onAdd: (title) => add(title, "DAILY", today) }}
          />
          <div className="hidden md:block">
            <TaskListCard
              title="This week"
              subtitle={labels.week}
              tasks={weekTasks}
              today={today}
              emptyText="No weekly tasks yet."
              list={handlers}
              add={{ label: "Add a task for this week", onAdd: (title) => add(title, "WEEKLY", weekStart) }}
            />
          </div>
          {earlierTasks.length > 0 && (
            <div className="hidden md:block">
              <OpenEarlierCard tasks={earlierTasks} today={today} list={handlers} />
            </div>
          )}
          <PhoneSummaryRows weekTasks={weekTasks} earlierTasks={earlierTasks} />
        </div>
      </div>
    </div>
  );
}

// Phones link to the to-dos page instead of showing the weekly and earlier lists.
function PhoneSummaryRows({ weekTasks, earlierTasks }: { weekTasks: TaskView[]; earlierTasks: TaskView[] }) {
  const week = countDone(weekTasks);
  const missed = missedSummary(earlierTasks);

  return (
    <div className="flex flex-col gap-4 md:hidden">
      <LinkRow href="/todos" action="View">
        <span className="font-semibold">
          {week.done} of {week.total}
        </span>{" "}
        weekly tasks done
      </LinkRow>
      {missed.firstDay && (
        <LinkRow href={`/todos?date=${missed.firstDay}`} action="Review">
          <span className="font-semibold text-warning">{missed.count} missed</span> on {missed.dayNames}
        </LinkRow>
      )}
    </div>
  );
}

function LinkRow({ href, action, children }: { href: string; action: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span>{children}</span>
      <span className="text-sm font-medium text-primary-text">{action}</span>
    </Link>
  );
}
