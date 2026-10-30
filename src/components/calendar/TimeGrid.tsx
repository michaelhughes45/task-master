import { AllDayRow } from "@/components/calendar/AllDayRow";
import { DayColumn } from "@/components/calendar/DayColumn";
import { GridScroller } from "@/components/calendar/GridScroller";
import { HOUR_HEIGHT } from "@/lib/calendar-layout";
import { cn } from "@/lib/utils";
import type { CalendarColumn } from "@/types/calendar";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function hourLabel(hour: number) {
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
}

interface TimeGridProps {
  columns: CalendarColumn[];
  scrollHour: number;
  tz: string;
}

// Header row, optional all-day row and the 24-hour grid, in one card that scrolls both ways
// (the week view keeps a 760px minimum width). The header and hour gutter stay in view.
export function TimeGrid({ columns, scrollHour, tz }: TimeGridProps) {
  const isWeek = columns.length > 1;
  const gridClass = isWeek ? "grid-cols-[56px_repeat(7,minmax(0,1fr))]" : "grid-cols-[56px_minmax(0,1fr)]";
  const hasAllDay = columns.some((column) => column.allDay.length > 0);

  return (
    <GridScroller
      scrollTop={scrollHour * HOUR_HEIGHT}
      resetKey={`${columns.length}-${columns[0].day}`}
      className="h-[calc(100dvh-19rem)] min-h-80 overflow-auto rounded-lg border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-[calc(100dvh-13rem)]"
    >
      <div className={cn(isWeek && "min-w-[760px]")}>
        <div className="sticky top-0 z-20 border-b bg-card">
          <div className={cn("grid", gridClass)}>
            <div className="sticky left-0 bg-card" />
            {columns.map((column) => (
              <DayHeading key={column.day} column={column} />
            ))}
          </div>
          {hasAllDay && <AllDayRow columns={columns} gridClass={gridClass} />}
        </div>
        <div className={cn("grid", gridClass)}>
          <div aria-hidden="true" className="sticky left-0 z-10 bg-card">
            {HOURS.map((hour) => (
              <div key={hour} className="relative h-12">
                {hour > 0 && (
                  <span className="absolute -top-2 right-2 font-mono text-[11.5px] text-muted-foreground">
                    {hourLabel(hour)}
                  </span>
                )}
              </div>
            ))}
          </div>
          {columns.map((column) => (
            <DayColumn key={column.day} column={column} tz={tz} />
          ))}
        </div>
      </div>
    </GridScroller>
  );
}

function DayHeading({ column }: { column: CalendarColumn }) {
  return (
    <div className="border-l px-1.5 py-2 text-center">
      <div className="text-[12.5px] font-medium text-muted-foreground">{column.heading}</div>
      <div
        aria-current={column.isToday ? "date" : undefined}
        className={cn(
          "mx-auto mt-0.5 flex h-[30px] items-center justify-center text-[15px] font-semibold",
          column.isToday && "w-[30px] rounded-full bg-primary text-primary-foreground",
        )}
      >
        {column.dayNumber}
      </div>
    </div>
  );
}
