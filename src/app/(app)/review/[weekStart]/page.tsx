import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReviewView } from "@/components/review/ReviewView";
import { formatWeekRange, isDateStr, resolveTimezone, todayIn, weekStartOf } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Weekly review" };

// Reads the session and params.
export const instant = false;

// Any past week, or this one. Other days go to their Monday; bad dates and later weeks to /review.
export default async function ReviewWeekPage({ params }: PageProps<"/review/[weekStart]">) {
  const user = await requireUser();
  const tz = resolveTimezone(user);
  const now = new Date();
  const { weekStart: param } = await params;

  if (!isDateStr(param)) redirect("/review");
  const weekStart = weekStartOf(param);
  if (weekStart > weekStartOf(todayIn(tz, now))) redirect("/review");
  if (weekStart !== param) redirect(`/review/${weekStart}`);

  return (
    <>
      <PageHeader kicker="Weekly review" title={`Week of ${formatWeekRange(weekStart)}`} />
      <div className="w-full max-w-[1240px] px-4 py-6 md:px-8">
        <ReviewView userId={user.id} weekStart={weekStart} tz={tz} now={now} />
      </div>
    </>
  );
}
