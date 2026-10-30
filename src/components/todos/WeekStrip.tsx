import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DateStr } from "@/types/dates";

export interface WeekStripDay {
  day: DateStr;
  // "Mon"
  shortName: string;
  // "Monday, October 26", for screen readers
  longName: string;
  done: number;
  total: number;
  isToday: boolean;
  isPast: boolean;
}

interface WeekStripProps {
  days: WeekStripDay[];
  selected: DateStr;
}

function countClass({ done, total, isPast }: WeekStripDay) {
  if (total > 0 && done === total) return "text-success-ink";
  if (isPast && done < total) return "text-warning";
  return "text-muted-foreground";
}

export function WeekStrip({ days, selected }: WeekStripProps) {
  return (
    <nav aria-label="Days of the week">
      <ul className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((d) => {
          const isSelected = d.day === selected;
          return (
            <li key={d.day} className="min-w-0">
              <Link
                href={`/todos?date=${d.day}`}
                aria-current={isSelected ? "date" : undefined}
                aria-label={`${d.longName}${d.isToday ? ", today" : ""}: ${d.done} of ${d.total} done`}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-px rounded-lg border px-1 py-2.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected ? "border-primary bg-primary-soft hover:bg-primary-soft" : "bg-card",
                  d.isToday && !isSelected && "shadow-[inset_0_-3px_0_var(--primary)]",
                )}
              >
                <span className="text-[12.5px] font-medium text-muted-foreground">{d.shortName}</span>
                <span className="text-lg font-semibold">{Number(d.day.slice(8))}</span>
                <span className={cn("font-mono text-xs", countClass(d))}>
                  {d.done}/{d.total}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
