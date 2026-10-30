"use client";

import Link from "next/link";
import { useItemDialogs } from "@/hooks/use-item-dialogs";
import { eventTiming, type ScheduleItem } from "@/lib/today";
import { cn } from "@/lib/utils";
import type { EventColor } from "@/types/events";

const DOT_CLASS: Record<EventColor, string> = {
  BLUE: "bg-primary",
  GREEN: "bg-success",
};

interface ScheduleCardProps {
  items: ScheduleItem[];
  // The current minute (ms); past events are muted and the current one marked "Now".
  now: number | null;
}

// Today's events, all-day first. Phones show the start time and title only.
export function ScheduleCard({ items, now }: ScheduleCardProps) {
  return (
    <section aria-labelledby="today-schedule" className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-3">
        <h2 id="today-schedule" className="text-[15px] font-semibold">
          Schedule
        </h2>
        <Link
          href="/calendar"
          className="rounded-sm py-1 text-[13.5px] font-medium text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Open calendar
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="border-t px-4 py-3.5 text-sm text-muted-foreground">No events today.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.key} className="border-t">
              <ScheduleRow item={item} timing={now === null ? "upcoming" : eventTiming(item, now)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScheduleRow({ item, timing }: { item: ScheduleItem; timing: ReturnType<typeof eventTiming> }) {
  const { openEvent } = useItemDialogs();
  const past = timing === "past";
  const time = item.endLabel ? `${item.startLabel} to ${item.endLabel}` : item.startLabel;
  const status = timing === "now" ? ", happening now" : past ? ", ended" : "";

  return (
    <button
      type="button"
      onClick={() => openEvent(item.details)}
      aria-label={`${item.title}, ${time}${status}`}
      className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:items-start md:gap-3.5"
    >
      <span
        className={cn(
          "min-w-[70px] flex-none font-mono text-[13px] leading-normal md:min-w-[74px]",
          past ? "text-muted-foreground" : "text-foreground",
        )}
      >
        <span className="block">{item.startLabel}</span>
        {item.endLabel && <span className="hidden text-muted-foreground md:block">{item.endLabel}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn("size-2 flex-none rounded-full md:mt-[7px]", DOT_CLASS[item.color], past && "opacity-45")}
      />
      <span className="block min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "break-words",
              past ? "font-medium text-muted-foreground md:font-semibold" : "font-medium md:font-semibold",
              timing === "now" && "font-semibold",
            )}
          >
            {item.title}
          </span>
          {timing === "now" && (
            <span className="rounded-full bg-primary-soft px-2 py-px text-xs font-semibold text-primary-ink">Now</span>
          )}
        </span>
        {item.meta && <span className="hidden text-[13px] text-muted-foreground md:block">{item.meta}</span>}
      </span>
    </button>
  );
}
