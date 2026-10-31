import { formatWeekday } from "@/lib/dates";
import type { ReviewDay } from "@/types/review";

const TRACK_HEIGHT = 140;

// Daily tasks per day: the track's height is what was planned, the green fill what got done.
export function DayBars({ days }: { days: ReviewDay[] }) {
  const most = Math.max(...days.map((d) => d.planned), 0);

  return (
    <section aria-labelledby="review-days" className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="review-days" className="text-[15px] font-semibold">
          Day by day
        </h2>
        <div aria-hidden="true" className="flex gap-3.5 text-[12.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-success" />
            Done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] border bg-muted" />
            Planned
          </span>
        </div>
      </div>
      {most === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No daily tasks this week.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-7 gap-2">
          {days.map((day) => (
            <li key={day.day} className="flex flex-col items-center gap-1.5">
              <div aria-hidden="true" className="flex h-[140px] w-full items-end justify-center">
                {day.planned > 0 && (
                  <div
                    className="flex w-full max-w-[34px] flex-col justify-end overflow-hidden rounded-[4px] bg-muted"
                    style={{ height: Math.round((day.planned / most) * TRACK_HEIGHT) }}
                  >
                    <div className="bg-success" style={{ height: `${(day.done / day.planned) * 100}%` }} />
                  </div>
                )}
              </div>
              <span className="text-[12.5px] font-medium">{formatWeekday(day.day)}</span>
              <span aria-hidden="true" className="font-mono text-xs text-muted-foreground">
                {day.done}/{day.planned}
              </span>
              <span className="sr-only">
                {day.planned === 0 ? "nothing planned" : `${day.done} of ${day.planned} done`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
