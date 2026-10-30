import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { TodayBoard } from "@/components/today/TodayBoard";
import { formatDayLong, formatDayShort, formatWeekRange, resolveTimezone, todayIn, weekStartOf } from "@/lib/dates";
import { getEventsInRange } from "@/lib/db/events";
import { getDayTasks, getOpenEarlier, getWeekTasks } from "@/lib/db/tasks";
import { requireUser } from "@/lib/session";
import { buildSchedule } from "@/lib/today";

export const metadata: Metadata = { title: "Today" };

// Reads the session.
export const instant = false;

export default async function TodayPage() {
  const user = await requireUser();
  const tz = resolveTimezone(user);
  // One "now" for the whole render, so the day and the past / current events agree.
  const now = new Date();
  const serverNow = now.getTime();
  const today = todayIn(tz, now);
  const weekStart = weekStartOf(today);

  const [dayTasks, weekTasks, earlierTasks, events] = await Promise.all([
    getDayTasks(user.id, today, tz),
    getWeekTasks(user.id, weekStart, tz),
    getOpenEarlier(user.id, today, tz),
    getEventsInRange(user.id, today, today, tz),
  ]);

  return (
    <>
      <PageHeader kicker="Today" title={formatDayLong(today)} />
      <div className="w-full max-w-[1240px] px-4 py-6 md:px-8">
        <TodayBoard
          today={today}
          weekStart={weekStart}
          tz={tz}
          serverNow={serverNow}
          tasks={[...dayTasks, ...weekTasks, ...earlierTasks]}
          schedule={buildSchedule(events, today, tz)}
          labels={{ day: formatDayShort(today), week: formatWeekRange(weekStart) }}
        />
      </div>
    </>
  );
}
