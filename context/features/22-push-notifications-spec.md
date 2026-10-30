# Sunday Review Push Notification

## Overview

Send a web push notification at 7 PM on Sunday in each user's timezone saying their weekly review is ready. Users opt in from Settings; a Vercel Cron job runs hourly and sends to users whose local time is Sunday 7 PM.

## Requirements

- Install `web-push`. Generate VAPID keys (`npx web-push generate-vapid-keys`); env `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (add to `.env.example`).
- Prisma `PushSubscription` (`endpoint` unique, `p256dh`, `auth`, `userId`, `createdAt`), cascade from `User`. Migration `push`.
- `src/actions/push.ts`: `saveSubscription(sub)` (upsert by endpoint for the session user), `removeSubscription(endpoint)`, `sendTestNotification()`.
- Settings → "Sunday review reminder" switch:
  - Turning it on asks for notification permission, subscribes via the service worker (`pushManager.subscribe` with the VAPID key), saves the subscription and sets `reviewNotify = true`
  - Turning it off unsubscribes this device and sets `reviewNotify = false`
  - Shows clear states: not supported, permission denied (how to re-enable), iPhone not installed ("Add to Home Screen first")
  - "Send a test notification" button when subscribed
- `public/sw.js`: `push` handler shows the notification (title "Your weekly review is ready", body e.g. "You finished 28 of 36 tasks this week.", icon); `notificationclick` focuses or opens `/review`.
- `src/app/api/cron/review/route.ts`:
  - Rejects requests without `Authorization: Bearer ${CRON_SECRET}` (constant-time compare)
  - Finds users with `reviewNotify` and at least one subscription whose local time is Sunday 19:00–19:59 (`src/lib/notify-schedule.ts`, pure, with tests incl. DST weekends and a zone with a :30/:45 offset like `Asia/Kolkata`, `Asia/Kathmandu`)
  - Builds the body from `getWeeklyReview` for the current week
  - Sends with `web-push`; deletes subscriptions that return 404 or 410
  - Returns a JSON summary (sent, removed, failed)
- `vercel.json`: cron `0 * * * *` → `/api/cron/review`. Note that zones with :30/:45 offsets get the hourly run between 7:00 and 7:59 PM local, which is fine.

## Files to Create / Modify

1. `prisma/schema.prisma` + migration
2. `src/actions/push.ts`, `src/lib/push.ts`, `src/lib/notify-schedule.ts` (+ tests)
3. `src/app/api/cron/review/route.ts` (+ test for auth and selection)
4. `public/sw.js`, `src/components/settings/ReviewReminder.tsx`, `vercel.json`

## Key Gotchas

- A user can have several devices; send to each subscription.
- Never log subscription keys.
- Notifications on iPhone only work in the installed app (iOS 16.4+).

## Testing

1. Unit tests for the schedule function and the cron auth check.
2. Locally: enable in Settings, "Send a test notification" arrives; clicking it opens `/review`.
3. Call the cron route with the secret while faking the time (inject `now`) → notification sent; without the secret → 401.
4. Turning it off stops notifications for that device. `npm run build` passes.

## References

- https://github.com/web-push-libs/web-push
- https://vercel.com/docs/cron-jobs
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
