import { isCronAuthorized } from "@/lib/cron-auth";
import { getWeeklyReview } from "@/lib/db/review";
import { env } from "@/lib/env";
import { REVIEW_NOTIFICATION_TITLE, reviewNotices, reviewNotificationBody } from "@/lib/notify-schedule";
import { prisma } from "@/lib/prisma";
import { sendPush, type SendSummary } from "@/lib/push";

// Outside production, `?now=<ISO instant>` fakes the clock so another week's run can be tested.
function runTime(request: Request) {
  const fake = new URL(request.url).searchParams.get("now");
  if (env.NODE_ENV === "production" || !fake) return new Date();
  const parsed = new Date(fake);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Weekly (vercel.json: `0 2 * * 1`, 02:00 UTC Monday = Sunday 7–8 PM in Denver; Vercel Hobby
// allows at most one run a day). Sends "Your weekly review is ready" to every device of each
// user with the reminder on, with the numbers of their latest ready week.
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = runTime(request);

  const users = await prisma.user.findMany({
    where: { reviewNotify: true, pushSubscriptions: { some: {} } },
    select: {
      id: true,
      timezone: true,
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  const summary: SendSummary & { users: number } = { users: 0, sent: 0, removed: 0, failed: 0 };
  for (const { user, tz, weekStart } of reviewNotices(users, now)) {
    try {
      const review = await getWeeklyReview(user.id, weekStart, tz, now);
      const result = await sendPush(user.pushSubscriptions, {
        title: REVIEW_NOTIFICATION_TITLE,
        body: reviewNotificationBody(review.totals),
        url: `/review/${weekStart}`,
      });
      summary.users += 1;
      summary.sent += result.sent;
      summary.removed += result.removed;
      summary.failed += result.failed;
    } catch (err) {
      console.error(`Review notification for user ${user.id} failed`, err);
      summary.failed += user.pushSubscriptions.length;
    }
  }
  return Response.json(summary);
}
