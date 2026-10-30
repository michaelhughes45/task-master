"use client";

import { useSyncExternalStore } from "react";
import { minutesToPx } from "@/lib/calendar-layout";
import { instantToWallMinutes, todayIn } from "@/lib/dates";
import type { DateStr } from "@/types/dates";

const MINUTE_MS = 60 * 1000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, MINUTE_MS);
  return () => clearInterval(id);
}

// Whole minutes, so the snapshot only changes once a minute.
const currentMinute = () => Math.floor(Date.now() / MINUTE_MS);

// The current time on today's column. Client-only: the server's "now" would never match the
// browser's at hydration.
export function NowLine({ day, tz }: { day: DateStr; tz: string }) {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  if (minute === null) return null;

  const now = new Date(minute * MINUTE_MS);
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
