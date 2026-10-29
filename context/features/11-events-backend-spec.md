# Events — Data Model, Queries, Actions and Seed

## Overview

Add one-off calendar events (timed or all-day) to the database with queries and server actions, and seed the demo user's week of events. No UI (specs 12–14). Recurrence comes in spec 15.

## Requirements

- Prisma `Event` model (no `rrule` / exceptions yet): `id`, `userId`, `title`, `notes?`, `location?`, `color` (`BLUE` | `GREEN`, default `BLUE`), `allDay` (default false), `startAt`, `endAt` (UTC instants), timestamps; index `[userId, startAt]`; cascade from `User`. Migration `events`.
- All-day events: `startAt` = start of the day in the user's timezone, `endAt` = start of the day after the last day (exclusive). Document this in the model comment.
- `src/lib/db/events.ts`:
  - `getEventsInRange(userId, rangeStart, rangeEnd)` → events overlapping the range (`startAt < rangeEnd && endAt > rangeStart`), ordered by `allDay desc, startAt`
  - Returns `EventView` (`src/types/events.ts`): id, title, notes, location, color, allDay, startAt, endAt
- `src/actions/events.ts` (Zod, ownership, `{ success, data?, error? }`, revalidate `/today` and `/calendar`):
  - `createEvent({ title, date, startTime?, endTime?, allDay, location?, notes?, color })`: wall times converted with `wallTimeToInstant` in the user's timezone; end must be after start; an end time earlier than the start means "next day" only if explicitly allowed later (for now: error)
  - `updateEvent(id, same fields)`
  - `deleteEvent(id)`
- Extend the seed with the mockup's events for the current week (gym, deep work blocks, lunch, dentist, Spanish class, haircut, movie night, hike, party, meal prep, weekly review), placed on the right weekdays relative to today.

## Files to Create / Modify

1. `prisma/schema.prisma` + migration, `prisma/seed.ts`
2. `src/lib/db/events.ts`, `src/actions/events.ts` (+ tests)
3. `src/lib/validations/events.ts`, `src/types/events.ts`

## Testing

1. Action tests: end before start rejected; wall time → UTC correct for New York in summer and winter; ownership enforced.
2. Range query includes an event that starts before the range and ends inside it.
3. Seed re-run is idempotent. `npm run build` passes.
