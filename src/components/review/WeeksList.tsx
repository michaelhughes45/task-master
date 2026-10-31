import Link from "next/link";
import type { ReviewWeekLink } from "@/lib/review-view";
import { cn } from "@/lib/utils";
import type { DateStr } from "@/types/dates";

interface WeeksListProps {
  weeks: ReviewWeekLink[];
  selected: DateStr;
  // "This week's review is ready Sunday, Nov 1 at 7:00 PM."
  readyLine: string;
}

// A column on desktop; on phones a row that scrolls sideways on its own.
export function WeeksList({ weeks, selected, readyLine }: WeeksListProps) {
  return (
    <nav aria-labelledby="review-weeks" className="min-w-0">
      <h2
        id="review-weeks"
        className="px-2.5 pb-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Weeks
      </h2>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {weeks.map((week) => {
          const current = week.weekStart === selected;
          return (
            <li key={week.weekStart} className="flex-none">
              <Link
                href={`/review/${week.weekStart}`}
                aria-current={current ? "page" : undefined}
                aria-label={`Week of ${week.label}, ${week.rate === null ? "nothing planned" : `${week.rate}% done`}`}
                className={cn(
                  "flex h-11 items-center justify-between gap-3 rounded-md border px-3 text-[14.5px] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-10 lg:border-0 lg:px-2.5",
                  current
                    ? "border-transparent bg-primary-soft font-semibold text-primary-ink"
                    : "bg-card text-foreground hover:bg-muted lg:bg-transparent",
                )}
              >
                <span>{week.label}</span>
                <span className="font-mono text-[13px]">{week.rate === null ? "–" : `${week.rate}%`}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 px-2.5 text-[13px] text-muted-foreground">{readyLine}</p>
    </nav>
  );
}
