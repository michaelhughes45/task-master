"use client";

import { useItemDialogs } from "@/hooks/use-item-dialogs";
import { HOUR_HEIGHT } from "@/lib/calendar-layout";
import type { DateStr } from "@/types/dates";

// Fills a day column under its events. A click opens the New dialog as an event at that
// time; keyboard users have the header's New button.
export function EmptySlotArea({ day }: { day: DateStr }) {
  const { openNewEvent } = useItemDialogs();

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    openNewEvent(day, Math.floor((y / HOUR_HEIGHT) * 60));
  }

  return <div aria-hidden="true" onClick={handleClick} className="absolute inset-0 cursor-pointer" />;
}
