import { countDone } from "@/lib/task-list";
import type { TaskView } from "@/types/tasks";

interface SummaryLineProps {
  dayTasks: TaskView[];
  weekTasks: TaskView[];
  eventCount: number;
}

// "3/5 done today · 2/5 weekly done · 5 events today"
export function SummaryLine({ dayTasks, weekTasks, eventCount }: SummaryLineProps) {
  const day = countDone(dayTasks);
  const week = countDone(weekTasks);

  return (
    <p className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
      <span>
        <Count>
          {day.done}/{day.total}
        </Count>{" "}
        done today
      </span>
      <span>
        <Count>
          {week.done}/{week.total}
        </Count>{" "}
        weekly done
      </span>
      <span>
        <Count>{eventCount}</Count> {eventCount === 1 ? "event" : "events"} today
      </span>
    </p>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <strong className="font-mono font-semibold text-foreground">{children}</strong>;
}
