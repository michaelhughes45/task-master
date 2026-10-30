import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { TodosBoard } from "@/components/todos/TodosBoard";
import type { WeekStripDay } from "@/components/todos/WeekStrip";
import {
  formatDayLong,
  formatDayShort,
  formatWeekRange,
  isBefore,
  parseDateParam,
  resolveTimezone,
  todayIn,
  weekStartOf,
} from "@/lib/dates";
import { getDayTasks, getWeekDayCounts, getWeekTasks } from "@/lib/db/tasks";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "To-dos" };

// Reads the session and searchParams.
export const instant = false;

export default async function TodosPage({ searchParams }: PageProps<"/todos">) {
  const user = await requireUser();
  const tz = resolveTimezone(user);
  const today = todayIn(tz);
  const day = parseDateParam((await searchParams).date, today);
  const weekStart = weekStartOf(day);
  const isThisWeek = weekStart === weekStartOf(today);

  const [dayTasks, weekTasks, counts] = await Promise.all([
    getDayTasks(user.id, day, tz),
    getWeekTasks(user.id, weekStart, tz),
    getWeekDayCounts(user.id, weekStart),
  ]);

  const stripDays: WeekStripDay[] = counts.map((count) => ({
    ...count,
    shortName: formatDayShort(count.day).split(",")[0],
    longName: formatDayLong(count.day),
    isToday: count.day === today,
    isPast: isBefore(count.day, today),
  }));
  const isPastDay = isBefore(day, today);
  const weekday = formatDayLong(day).split(",")[0];

  return (
    <>
      <PageHeader kicker="To-dos" title={`Week of ${formatWeekRange(weekStart)}`} />
      <div className="px-4 py-6 md:px-8">
        <TodosBoard
          day={day}
          weekStart={weekStart}
          today={today}
          tasks={[...dayTasks, ...weekTasks]}
          stripDays={stripDays}
          isPastDay={isPastDay}
          dayLabels={{
            title: formatDayLong(day),
            subtitle: day === today ? "Today" : isPastDay ? "Past day" : undefined,
            addLabel: `Add a task for ${weekday}`,
          }}
          weekLabels={{
            title: isThisWeek ? "This week" : "Weekly",
            subtitle: formatWeekRange(weekStart),
            addLabel: isThisWeek ? "Add a task for this week" : "Add a task for that week",
          }}
        />
      </div>
    </>
  );
}
