# Tasks — Data Model, Queries, Actions and Seed

## Overview

Add one-off (non-repeating) daily and weekly tasks and their completions to the database, with queries and server actions, plus a demo user with seed data. No UI (that's spec 09). Recurrence is added in spec 15.

## Requirements

- Prisma models (see `context/project-overview.md` data model), **without** `rrule` and `TaskException` for now:
  - `Task`: `id`, `userId`, `title`, `notes?`, `scope` (`DAILY` | `WEEKLY`), `priority` (`LOW` | `NORMAL` | `HIGH`, default `NORMAL`), `date` (`@db.Date`: the day, or the week's Monday), timestamps; index `[userId, date]`
  - `TaskCompletion`: `id`, `taskId`, `occurrenceDate` (`@db.Date`), `completedAt` (default now), `minutesSpent?`, `workNote?`; unique `[taskId, occurrenceDate]`
  - Cascade deletes from `User` and `Task`
  - Migration `tasks`
- `src/lib/db/tasks.ts` (server-only queries, all filtered by `userId`):
  - `getDayTasks(userId, day)` → daily tasks for that day with their completion
  - `getWeekTasks(userId, weekStart)` → weekly tasks for that week with completion
  - `getWeekDayCounts(userId, weekStart)` → done/total per day for the week strip
  - `getOpenEarlier(userId, today, tz)` → this week's past-day daily tasks not done (and ones done late today)
  - Return plain view types (`TaskView` in `src/types/tasks.ts`): id, title, notes, scope, priority, day, done, doneLate, minutesSpent, workNote
- `src/actions/tasks.ts` (each validates with Zod, checks ownership with `where: { id, userId }`, returns `{ success, data?, error? }`, revalidates affected paths):
  - `createTask({ title, scope, date, priority?, notes? })` (weekly `date` is normalized to the Monday)
  - `updateTask(id, { title?, priority?, notes?, date? })`
  - `deleteTask(id)`
  - `completeTask(taskId, occurrenceDate)` (upsert; `completedAt = now`)
  - `uncompleteTask(taskId, occurrenceDate)` (delete completion)
  - `saveCompletionDetails(taskId, occurrenceDate, { minutesSpent?, workNote? })` (0–1440 minutes, note ≤ 500 chars)
- Done late is derived, not stored: use `isDoneLate` from `src/lib/dates.ts`.
- **Seed** (`prisma/seed.ts`, `npx prisma db seed`, wired in `prisma.config.ts`):
  - `src/lib/demo-user.ts`: `DEMO_USER_EMAIL = "demo@taskmaster.test"`, `DEMO_USER_PASSWORD`
  - Demo user created through Better Auth's password hashing so it can sign in, timezone `America/New_York`, email verified
  - The mockup's tasks for the **current** week (computed from today, not hard-coded dates): a few done, a few missed on past days, two with minutes and notes, five weekly tasks
  - Safe to re-run: deletes and recreates the demo user's tasks only

## Files to Create / Modify

1. `prisma/schema.prisma` + migration, `prisma/seed.ts`, `prisma.config.ts`
2. `src/lib/db/tasks.ts`, `src/actions/tasks.ts` (+ `tasks.test.ts`)
3. `src/lib/validations/tasks.ts`, `src/types/tasks.ts`, `src/lib/demo-user.ts`

## Key Gotchas

- `occurrenceDate` for weekly tasks is the week's Monday.
- Don't trust `userId` from arguments in actions; get it from the session.
- Mock `@/lib/prisma` and `@/lib/session` in tests; never hit the database.

## Testing

1. Action tests: validation errors, ownership (another user's task id → not found), weekly date normalization, minutes bounds.
2. `npx prisma db seed` twice → same data, no duplicates.
3. Sign in as the demo user works.
4. `npm run build` passes.
