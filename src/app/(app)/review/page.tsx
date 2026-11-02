import type { Metadata } from "next";
import { ReviewPage } from "@/components/review/ReviewPage";
import { resolveTimezone } from "@/lib/dates";
import { defaultReviewWeek } from "@/lib/review-view";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Weekly review" };

// Reads the session.
export const instant = false;

// Last week's review, or this week's once it's ready on Sunday evening.
export default async function LatestReviewPage() {
  const user = await requireUser();
  const tz = resolveTimezone(user);
  const now = new Date();

  return <ReviewPage userId={user.id} weekStart={defaultReviewWeek(tz, now)} tz={tz} now={now} />;
}
