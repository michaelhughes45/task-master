import { MeterRow } from "@/components/review/MeterRow";
import { formatMinutes } from "@/lib/dates";
import type { ReviewTaskTime } from "@/types/review";

// The tasks with the most time logged; bars are relative to the top one.
export function TimeByTask({ times }: { times: ReviewTaskTime[] }) {
  if (times.length === 0) return <p className="text-sm text-muted-foreground">No time tracked this week.</p>;
  const most = times[0].minutes;
  return (
    <ul className="flex flex-col gap-3.5">
      {times.map((time) => (
        <MeterRow
          key={time.taskId}
          label={time.title}
          value={formatMinutes(time.minutes)}
          percent={Math.round((time.minutes / most) * 100)}
          tone="primary"
        />
      ))}
    </ul>
  );
}
