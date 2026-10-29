# Task Master — Plan

> The detailed, up-to-date version of this plan is `context/project-overview.md`.

A personal planner: calendar events at specific times, daily and weekly to-do lists, completion tracking, and a Sunday review of the week. Works on any device and is hosted online.

## Features

### Today page (home)
- The screen you open in the morning.
- Today's timed events, in order.
- Today's daily to-dos and this week's weekly to-dos, each with a checkbox.
- A small "still open from earlier" section listing recent unfinished tasks, so you can tick them off late.

### Calendar events
- Title, date, start and end time (or all day), and optional location, notes and color.
- Day, week and month views.
- Can repeat (see Recurrence).

### To-do lists
- **Daily tasks** belong to a specific day.
- **Weekly tasks** belong to a week (Monday–Sunday) and can be done any day that week.
- Tick a task done, with optional **time spent** and **what I worked on**.
- **Unfinished tasks stay on their own day** and count as missed. You can go back to any past day and mark them done later; the app records both the day the task was for and when you actually ticked it.
- Can repeat (see Recurrence).

### Recurrence (like Google Calendar)
Works for both events and tasks:
- Does not repeat / Daily / Weekly on chosen days / Monthly / Yearly / Every weekday
- Custom: every N days, weeks, months or years
- Ends: never, on a date, or after N times
- When editing or deleting a repeating item: **this one only**, **this and following**, or **all**

### Sunday review
- One page per week, with past weeks kept so you can look back.
- Shows:
  - Completion rate (done / planned), overall and for daily vs. weekly tasks
  - Done vs. missed lists
  - Total time spent, broken down by task
  - Repeating tasks you missed most often
  - Comparison with last week
  - Your "what I worked on" notes for the week
- **Calculated from live data**, so ticking a task off late updates that week's review.
- Each completion shows whether it was **done on time** or **ticked off late**.

### Notifications
- The app can be installed to your phone or computer's home screen (PWA).
- A **push notification on Sunday evening**: "Your weekly review is ready."
- On iPhone, the app must be added to the Home Screen before it can show notifications (Apple's rule).
- Event reminders could be added later.

### Sign-in
- Email and password, or Google account.
- Only you can see your data.

## Tech stack

| Part | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | Neon (Postgres) |
| Database access | Prisma ORM |
| Sign-in | Better Auth (email/password + Google), stored in Neon via Prisma |
| Recurrence rules | `rrule` (the same format Google Calendar uses) |
| Hosting | Vercel |
| Sunday job | Vercel Cron |
| Notifications | Web Push (service worker + `web-push`) |

**Why Better Auth rather than Auth.js:** Auth.js discourages email/password sign-in and leaves password hashing, password reset and email verification to you. Better Auth includes all three, plus Google sign-in, and works with Prisma and Neon.

## Data model (outline)

- **users, sessions, accounts**: managed by Better Auth. Each user also has a timezone setting.
- **events**: title, notes, location, color, start, end, all-day flag, recurrence rule.
- **event_exceptions**: changes to or cancellations of a single occurrence of a repeating event.
- **tasks**: title, notes, type (daily or weekly), date or week start, recurrence rule, optional priority.
- **task_exceptions**: a single skipped or changed occurrence of a repeating task.
- **task_completions**: task, the occurrence date it was for, when it was ticked, minutes spent, work note.
- **push_subscriptions**: the devices that should get notifications.

Repeating items are stored once, with a rule. Occurrences are generated when a day or week is displayed, so nothing piles up in the database.

## Build phases

1. **Setup**: Next.js project, Tailwind, Prisma + Neon, Better Auth (email/password + Google), app layout.
2. **To-do lists**: daily and weekly tasks, ticking off, time spent and notes, late completion of past tasks.
3. **Events and calendar**: create and edit events; day, week and month views.
4. **Recurrence**: repeating options for tasks and events, plus "this one / following / all" edits.
5. **Today page**: the morning overview.
6. **Weekly review**: review page and week history.
7. **PWA and notifications**: installable app and the Sunday push notification via Vercel Cron.
8. **Deploy**: Vercel, production database, Google sign-in set up for the live address.

## What you'll need to set up (I'll walk you through each)

- A **Neon** project. Paste its connection string into `.env.local` yourself.
- A **Google Cloud** OAuth client for "Sign in with Google".
- A **Vercel** account for hosting (phase 8).

## Open decisions (sensible defaults for now)

- Week runs **Monday–Sunday**, and the review notification goes out **Sunday at 7pm** in your timezone.
- Priorities on tasks: simple **low / normal / high**.
