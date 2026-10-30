"use client";

import { useCurrentMinute } from "@/hooks/use-current-minute";
import { minutesToPx } from "@/lib/calendar-layout";
import { instantToWallMinutes, todayIn } from "@/lib/dates";
import type { DateStr } from "@/types/dates";

// The current time on today's column. Client-only: the server's "now" would never match the
// browser's at hydration.
export function NowLine({ day, tz }: { day: DateStr; tz: string }) {
  const minute = useCurrentMinute(null);
  if (minute === null) return null;

  const now = new Date(minute);
  // The page may have stayed open past midnight.
  if (todayIn(tz, now) !== day) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-primary"
      // Positioned by the time of day, so it can't be a static class.
      style={{ top: minutesToPx(instantToWallMinutes(now, tz)) - 1 }}
    >
      <span className="absolute -top-1 -left-[5px] size-2.5 rounded-full bg-primary" />
    </div>
  );
}
