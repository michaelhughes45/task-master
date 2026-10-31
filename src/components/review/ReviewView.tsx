import { DayBars } from "@/components/review/DayBars";
import { LateList } from "@/components/review/LateList";
import { MissedList } from "@/components/review/MissedList";
import { MostMissed } from "@/components/review/MostMissed";
import { NotesList } from "@/components/review/NotesList";
import { SplitBars } from "@/components/review/SplitBars";
import { StatsStrip } from "@/components/review/StatsStrip";
import { TimeByTask } from "@/components/review/TimeByTask";
import { WeeksList } from "@/components/review/WeeksList";
import { addWeeks, formatWeekRange, todayIn, weekStartOf } from "@/lib/dates";
import { getReviewWeeks, getWeeklyReview, getWeekRates } from "@/lib/db/review";
import {
  defaultReviewWeek,
  formatReadyAt,
  groupMissed,
  lateItems,
  reviewSummary,
  reviewWeekList,
} from "@/lib/review-view";
import type { DateStr } from "@/types/dates";
import type { WeeklyReview } from "@/types/review";

interface ReviewViewProps {
  userId: string;
  weekStart: DateStr;
  tz: string;
  now: Date;
}

const GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-6";

export async function ReviewView({ userId, weekStart, tz, now }: ReviewViewProps) {
  const thisMonday = weekStartOf(todayIn(tz, now));
  const latestReady = defaultReviewWeek(tz, now);
  const [review, weeks] = await Promise.all([
    getWeeklyReview(userId, weekStart, tz, now),
    getReviewWeeks(userId, tz, now),
  ]);
  const readyWeeks = weeks.filter((week) => week <= latestReady);
  const readyLine =
    latestReady === thisMonday
      ? `Next week's review is ready ${formatReadyAt(addWeeks(thisMonday, 1), tz)}.`
      : `This week's review is ready ${formatReadyAt(thisMonday, tz)}.`;

  // A new user: nothing to look back on yet.
  if (readyWeeks.length === 0 && review.totals.planned === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center">
        <p className="text-base font-medium">Your first review will be ready on Sunday.</p>
        <p className="mt-1 text-sm text-muted-foreground">{readyLine}</p>
      </div>
    );
  }

  const rates = await getWeekRates(userId, [...new Set([...readyWeeks, weekStart])], tz, now);
  const weekLinks = reviewWeekList({ weeks: readyWeeks, rates, selected: weekStart, latestReady });

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <WeeksList weeks={weekLinks} selected={weekStart} readyLine={readyLine} />
      {review.totals.planned === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-center">
          <p className="text-base font-medium">Nothing was planned this week.</p>
          <p className="mt-1 text-sm text-muted-foreground">Pick another week to see its review.</p>
        </div>
      ) : (
        <ReviewBody review={review} />
      )}
    </div>
  );
}

function ReviewBody({ review }: { review: WeeklyReview }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p className="max-w-[62ch] text-base">{reviewSummary(review)}</p>
      <StatsStrip review={review} previousLabel={formatWeekRange(addWeeks(review.weekStart, -1))} />
      <div className={GRID}>
        <DayBars days={review.perDay} />
        <div className="flex flex-col gap-3.5 rounded-lg border bg-card p-4">
          <h2 className="text-[15px] font-semibold">Daily and weekly lists</h2>
          <SplitBars daily={review.daily} weekly={review.weekly} />
          <h2 className="mt-2 text-[15px] font-semibold">Time by task</h2>
          <TimeByTask times={review.timeByTask} />
        </div>
      </div>
      <div className={GRID}>
        <MissedList groups={groupMissed(review.missed)} count={review.totals.missed} />
        <LateList items={lateItems(review.done, review.weekStart)} />
      </div>
      <div className={GRID}>
        <MostMissed tasks={review.mostMissed} />
        <NotesList notes={review.notes} />
      </div>
    </div>
  );
}
