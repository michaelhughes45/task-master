import { EmptySlotArea } from "@/components/calendar/EmptySlotArea";
import { EventBlock } from "@/components/calendar/EventBlock";
import { NowLine } from "@/components/calendar/NowLine";
import type { CalendarColumn } from "@/types/calendar";

// 24 hours of --hour each (set by TimeGrid from HOUR_HEIGHT), with a hairline on every hour.
export function DayColumn({ column, tz }: { column: CalendarColumn; tz: string }) {
  return (
    <div className="relative h-[calc(var(--hour)*24)] border-l bg-[repeating-linear-gradient(to_bottom,var(--border)_0,var(--border)_1px,transparent_1px,transparent_var(--hour))]">
      <EmptySlotArea day={column.day} />
      {column.timed.map((event) => (
        <EventBlock key={event.key} event={event} />
      ))}
      {column.isToday && <NowLine day={column.day} tz={tz} />}
    </div>
  );
}
