import "server-only";
import { weekStartOf } from "@/lib/dates";
import { getWeekDayCounts, getWeekTasks } from "@/lib/db/tasks";
import type { DateStr } from "@/types/dates";

export interface WeekProgress {
  done: number;
  total: number;
}

// Every daily occurrence and weekly task in the week, done / planned, for the sidebar.
export async function getWeekProgress(userId: string, day: DateStr, tz: string): Promise<WeekProgress> {
  const monday = weekStartOf(day);
  const [days, weekly] = await Promise.all([getWeekDayCounts(userId, monday), getWeekTasks(userId, monday, tz)]);
  return {
    done: days.reduce((sum, d) => sum + d.done, 0) + weekly.filter((task) => task.done).length,
    total: days.reduce((sum, d) => sum + d.total, 0) + weekly.length,
  };
}
