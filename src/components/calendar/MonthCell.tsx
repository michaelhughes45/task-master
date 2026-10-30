import Link from "next/link";
import { MonthEventChip } from "@/components/calendar/EventBlock";
import { calendarHref } from "@/lib/calendar-view";
import { cn } from "@/lib/utils";
import type { MonthDay } from "@/types/calendar";

const LINK_FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

interface MonthCellProps {
  cell: MonthDay;
  // Position in the grid, for the borders between cells.
  index: number;
}

// One day of the month grid. The number and "+N more" open the day view; chips open the event.
export function MonthCell({ cell, index }: MonthCellProps) {
  const dayHref = calendarHref("day", cell.day);

  return (
    <div
      className={cn(
        "min-h-[108px] min-w-0 px-2 py-1.5",
        index % 7 > 0 && "border-l",
        index >= 7 && "border-t",
        !cell.inMonth && "bg-background text-muted-foreground",
      )}
    >
      <Link
        href={dayHref}
        aria-label={cell.label}
        aria-current={cell.isToday ? "date" : undefined}
        className={cn(
          LINK_FOCUS,
          "inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full text-[13px]",
          cell.isToday
            ? "bg-primary font-semibold text-primary-foreground"
            : "-ml-1.5 px-1.5 font-medium hover:bg-muted",
        )}
      >
        {cell.dayNumber}
      </Link>
      {cell.chips.length > 0 && (
        <ul className="mt-[3px] flex flex-col gap-[3px]">
          {cell.chips.map((event) => (
            <li key={event.key}>
              <MonthEventChip event={event} />
            </li>
          ))}
        </ul>
      )}
      {cell.moreCount > 0 && (
        <Link
          href={dayHref}
          aria-label={`${cell.moreCount} more ${cell.moreCount === 1 ? "event" : "events"} on ${cell.label}`}
          className={cn(LINK_FOCUS, "mt-[3px] block rounded-[6px] text-xs text-muted-foreground hover:text-foreground")}
        >
          +{cell.moreCount} more
        </Link>
      )}
    </div>
  );
}
