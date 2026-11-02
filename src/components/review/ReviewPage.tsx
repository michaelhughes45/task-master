import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SkeletonBlock } from "@/components/layout/PageSkeleton";
import { ReviewView } from "@/components/review/ReviewView";
import { formatWeekRange } from "@/lib/dates";
import type { DateStr } from "@/types/dates";

interface ReviewPageProps {
  userId: string;
  weekStart: DateStr;
  tz: string;
  now: Date;
}

// Shared by /review and /review/[weekStart]. The header shows straight away; the review streams in.
export function ReviewPage({ userId, weekStart, tz, now }: ReviewPageProps) {
  return (
    <>
      <PageHeader kicker="Weekly review" title={`Week of ${formatWeekRange(weekStart)}`} />
      <div className="w-full max-w-[1240px] px-4 py-6 md:px-8">
        <Suspense fallback={<ReviewSkeleton />}>
          <ReviewView userId={userId} weekStart={weekStart} tz={tz} now={now} />
        </Suspense>
      </div>
    </>
  );
}

// Matches ReviewView's layout: the weeks column, then the summary and the first row of cards.
function ReviewSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <p className="sr-only" role="status">
        Loading the review…
      </p>
      <SkeletonBlock className="h-14 lg:h-80" />
      <div className="flex flex-col gap-6">
        <SkeletonBlock className="h-6 w-3/4" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-64" />
      </div>
    </div>
  );
}
