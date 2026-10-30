import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { calendarHref, stepDate } from "@/lib/calendar-view";
import { cn } from "@/lib/utils";
import type { CalendarView } from "@/types/calendar";
import type { DateStr } from "@/types/dates";

const VIEWS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
] as const;

const SEGMENT_CLASS =
  "flex h-10 items-center rounded-[6px] px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:px-3.5";

interface CalendarToolbarProps {
  view: CalendarView;
  date: DateStr;
  label: string;
}

// Every control is a link, so the URL holds the view and date and the back button works.
export function CalendarToolbar({ view, date, label }: CalendarToolbarProps) {
  const unit = view === "day" ? "day" : "week";

  return (
    <nav aria-label="Calendar" className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
      <Link
        href={calendarHref(view)}
        className={cn(buttonVariants({ variant: "outline" }), "h-11 px-3.5 text-sm md:h-9")}
      >
        Today
      </Link>
      <div className="flex">
        <Link
          href={calendarHref(view, stepDate(view, date, -1))}
          aria-label={`Previous ${unit}`}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 md:size-9")}
        >
          <ChevronLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <Link
          href={calendarHref(view, stepDate(view, date, 1))}
          aria-label={`Next ${unit}`}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 md:size-9")}
        >
          <ChevronRight className="size-[18px]" aria-hidden="true" />
        </Link>
      </div>
      {/* Phones already show the range as the page title. */}
      <p className="hidden text-base font-semibold md:block">{label}</p>
      <div role="group" aria-label="View" className="ml-auto inline-flex gap-0.5 rounded-md bg-muted p-[3px]">
        {VIEWS.map((option) => {
          const selected = option.value === view;
          return (
            <Link
              key={option.value}
              href={calendarHref(option.value, date)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                SEGMENT_CLASS,
                selected
                  ? "bg-card font-semibold text-foreground shadow-sm"
                  : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          );
        })}
        {/* The month view arrives in spec 14. */}
        <span aria-disabled="true" title="Coming soon" className={cn(SEGMENT_CLASS, "text-muted-foreground/50")}>
          Month
        </span>
      </div>
    </nav>
  );
}
