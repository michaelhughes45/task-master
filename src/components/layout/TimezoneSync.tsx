"use client";

import { useEffect, useRef } from "react";
import { setTimezoneIfMissing } from "@/actions/settings";

// Rendered only while the user has no timezone: sends the browser's zone once.
// The action revalidates the app, so pages re-render with the new zone.
export function TimezoneSync() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezoneIfMissing(timezone).then((result) => {
      if (!result.success) console.warn("Couldn't save the browser timezone:", result.error);
    });
  }, []);

  return null;
}
