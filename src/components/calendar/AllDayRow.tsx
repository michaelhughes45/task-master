import { AllDayEvent } from "@/components/calendar/EventBlock";
import { cn } from "@/lib/utils";
import type { CalendarColumn } from "@/types/calendar";

interface AllDayRowProps {
  columns: CalendarColumn[];
  // The grid's column template, shared with the header and the time grid.
  gridClass: string;
}

export function AllDayRow({ columns, gridClass }: AllDayRowProps) {
  return (
    <div className={cn("grid border-t", gridClass)}>
      <div className="sticky left-0 bg-card pt-1.5 pr-2 text-right font-mono text-[11px] text-muted-foreground">
        All day
      </div>
      {columns.map((column) => (
        <ul key={column.day} className="flex min-w-0 flex-col gap-1 border-l p-1">
          {column.allDay.map((event) => (
            <li key={event.key}>
              <AllDayEvent event={event} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
