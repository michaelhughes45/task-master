import { getWeekProgress, type WeekProgress } from "@/lib/db/progress";
import type { DateStr } from "@/types/dates";

interface SidebarWeekProgressProps {
  userId: string;
  today: DateStr;
  tz: string;
}

// Loaded behind the layout's Suspense, so the page doesn't wait for the sidebar's numbers.
export async function SidebarWeekProgress({ userId, today, tz }: SidebarWeekProgressProps) {
  return <WeekProgressBar progress={await getWeekProgress(userId, today, tz)} />;
}

// Daily occurrences plus weekly tasks done this week; an empty bar while loading.
export function WeekProgressBar({ progress }: { progress: WeekProgress | null }) {
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 px-2.5" aria-busy={progress === null || undefined}>
      <div className="flex justify-between text-[13px] text-muted-foreground">
        <span className="font-medium">This week</span>
        {progress && (
          <span className="font-mono" aria-label={`${progress.done} of ${progress.total} done`}>
            {progress.done}/{progress.total}
          </span>
        )}
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-[3px] bg-muted">
        {/* Width is the share done, so it can't be a static class. */}
        <div className="h-full rounded-[3px] bg-success transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
