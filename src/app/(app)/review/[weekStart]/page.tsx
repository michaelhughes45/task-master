import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReviewPage } from "@/components/review/ReviewPage";
import { isDateStr, resolveTimezone, todayIn, weekStartOf } from "@/lib/dates";
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

  return <ReviewPage userId={user.id} weekStart={weekStart} tz={tz} now={now} />;
}
