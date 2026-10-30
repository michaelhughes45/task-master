import { MonthCell } from "@/components/calendar/MonthCell";
import type { MonthDay } from "@/types/calendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Monday-start month grid in a card. Phones scroll it sideways (640px minimum width).
export function MonthGrid({ days }: { days: MonthDay[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="min-w-[640px]">
        <div aria-hidden="true" className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="px-2.5 py-2 text-[12.5px] font-medium text-muted-foreground">
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((cell, index) => (
            <MonthCell key={cell.day} cell={cell} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
