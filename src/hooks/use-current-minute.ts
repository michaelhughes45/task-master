"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60 * 1000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, MINUTE_MS);
  return () => clearInterval(id);
}

// Whole minutes, so the snapshot only changes once a minute.
const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

// The start of the current minute (ms), refreshed every minute. `serverNow` is what the server
// rendered with, used during hydration; null renders nothing time-based until the client knows.
export function useCurrentMinute(serverNow: number | null) {
  return useSyncExternalStore(subscribe, currentMinute, () =>
    serverNow === null ? null : Math.floor(serverNow / MINUTE_MS) * MINUTE_MS,
  );
}
