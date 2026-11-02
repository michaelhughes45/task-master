import { isCronAuthorized } from "@/lib/cron-auth";
import { getWeeklyReview } from "@/lib/db/review";
import { env } from "@/lib/env";
import {
  REVIEW_NOTIFICATION_TITLE,
  reviewNotices,
  reviewNotificationBody,
  type ReviewNotice,
} from "@/lib/notify-schedule";
import { prisma } from "@/lib/prisma";
import { sendPush, type SendSummary, type StoredSubscription } from "@/lib/push";

// Users are sent to a few at a time, so many users don't run past the time limit one by one.
const BATCH_SIZE = 5;
export const maxDuration = 60;

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

  const notices = reviewNotices(users, now);
  const summary: SendSummary & { users: number } = { users: 0, sent: 0, removed: 0, failed: 0 };
  for (let i = 0; i < notices.length; i += BATCH_SIZE) {
    const batch = notices.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((notice) => notify(notice, now)));
    results.forEach((result, j) => {
      if (result.status === "rejected") {
        const { user } = batch[j];
        console.error(`Review notification for user ${user.id} failed`, result.reason);
        summary.failed += user.pushSubscriptions.length;
        return;
      }
      summary.users += 1;
      summary.sent += result.value.sent;
      summary.removed += result.value.removed;
      summary.failed += result.value.failed;
    });
  }
  return Response.json(summary);
}

async function notify(
  { user, tz, weekStart }: ReviewNotice<{ id: string; pushSubscriptions: StoredSubscription[] }>,
  now: Date,
) {
  const review = await getWeeklyReview(user.id, weekStart, tz, now);
  return sendPush(user.pushSubscriptions, {
    title: REVIEW_NOTIFICATION_TITLE,
    body: reviewNotificationBody(review.totals),
    url: `/review/${weekStart}`,
  });
}
