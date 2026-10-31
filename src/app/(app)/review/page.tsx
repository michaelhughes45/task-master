import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReviewView } from "@/components/review/ReviewView";
import { formatWeekRange, resolveTimezone } from "@/lib/dates";
import { defaultReviewWeek } from "@/lib/review-view";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Weekly review" };

// Reads the session.
export const instant = false;

// Last week's review, or this week's once it's ready on Sunday evening.
export default async function ReviewPage() {
  const user = await requireUser();
  const tz = resolveTimezone(user);
  const now = new Date();
  const weekStart = defaultReviewWeek(tz, now);

  return (
    <>
      <PageHeader kicker="Weekly review" title={`Week of ${formatWeekRange(weekStart)}`} />
      <div className="w-full max-w-[1240px] px-4 py-6 md:px-8">
        <ReviewView userId={user.id} weekStart={weekStart} tz={tz} now={now} />
      </div>
    </>
  );
}
