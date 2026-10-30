import { instantToWallTime, parseDateParam, todayIn } from "@/lib/dates";
import type { DateStr, WallTime } from "@/types/dates";

export interface NewItemDefaults {
  date: DateStr;
  startTime: WallTime;
  endTime: WallTime;
}

function hourTime(hour: number): WallTime {
  return `${String(hour).padStart(2, "0")}:00`;
}

// The page's ?date= (from the URL's search string) or today in the user's zone, and the next
// full hour for an hour. Events can't cross midnight yet, so late at night it's 23:00–23:59.
export function newItemDefaults(search: string, tz: string, now: Date = new Date()): NewItemDefaults {
  const date = parseDateParam(new URLSearchParams(search).get("date") ?? undefined, todayIn(tz, now));
  const hour = Number(instantToWallTime(now, tz).slice(0, 2));
  const start = Math.min(hour + 1, 23);
  return {
    date,
    startTime: hourTime(start),
    endTime: start === 23 ? "23:59" : hourTime(start + 1),
  };
}

function minutesToTime(minutes: number): WallTime {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// A click on the calendar grid: the slot rounded down to 30 minutes, for an hour, ending by
// 23:59 at the latest.
export function slotDefaults(date: DateStr, minutes: number): NewItemDefaults {
  const start = Math.min(Math.max(Math.floor(minutes / 30) * 30, 0), 23 * 60 + 30);
  return {
    date,
    startTime: minutesToTime(start),
    endTime: minutesToTime(Math.min(start + 60, 23 * 60 + 59)),
  };
}
