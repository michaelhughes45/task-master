# Recurrence — Core Engine

## Overview

Let tasks and events repeat. Store each repeating item once with an RRULE string and expand it into occurrences when a day, week or month is loaded. This spec is the data model and engine only; the repeat options in the dialog come in spec 16, and "this / following / all" edits in spec 17.

## Requirements

- Install `rrule`.
- Schema (migration `recurrence`):
  - `rrule String?` on `Task` and `Event` (RFC 5545 `RRULE` part only, e.g. `FREQ=WEEKLY;BYDAY=MO,WE,FR`; null = does not repeat)
  - `TaskException`: `taskId`, `occurrenceDate` (`@db.Date`), `cancelled`, override fields (`title?`, `date?`); unique `[taskId, occurrenceDate]`
  - `EventException`: `eventId`, `occurrenceStart` (the original start instant), `cancelled`, overrides (`title?`, `startAt?`, `endAt?`, `location?`, `notes?`); unique `[eventId, occurrenceStart]`
- **Floating-time approach** (so DST doesn't shift events): the rule's DTSTART is the item's **local wall time** in the user's timezone, expanded by `rrule` as if it were UTC, then each result is converted to a real instant with `wallTimeToInstant`. Tasks expand by date only.
- `src/lib/recurrence.ts`:
  - `expandTask(task, exceptions, rangeStartDay, rangeEndDay)` → `TaskOccurrence[]` (`taskId`, `occurrenceDate`, title, …), applying cancellations and overrides; non-repeating tasks return themselves if in range
  - `expandEvent(event, exceptions, rangeStart, rangeEnd, tz)` → `EventOccurrence[]` with `occurrenceStart`, `startAt`, `endAt`; duration preserved
  - Weekly-scope tasks repeat by week (occurrence date is always a Monday)
  - Always bounded by the range (never expand an infinite rule without limits)
- Update the queries from specs 08 and 11 to load repeating items whose series could hit the range (`date <= rangeEnd` and either non-repeating in range or `rrule` not null), expand them, then attach completions by `(taskId, occurrenceDate)`.
- Seed: make the mockup's repeating items repeat (Review inbox every weekday, Read 20 pages and Stretch daily, Long run weekly; Gym Mon/Wed/Fri, Deep work weekdays, Spanish class Wednesdays, Weekly review Sundays).
- `src/lib/recurrence.test.ts` (the most important tests in the project):
  - Daily, weekdays, weekly on several days, every 2 weeks, monthly on the 31st (skips short months), monthly "4th Wednesday", "last Friday", yearly on Feb 29
  - `COUNT` and `UNTIL` (UNTIL day is included)
  - A 9:00 AM New York event stays 9:00 AM across Mar 8 and Nov 1, 2026
  - Cancelled and moved occurrences
  - Weekly tasks produce Mondays only

## Files to Create / Modify

1. `prisma/schema.prisma` + migration, `prisma/seed.ts`
2. `src/lib/recurrence.ts` (+ tests)
3. `src/lib/db/tasks.ts`, `src/lib/db/events.ts`
4. `src/types/tasks.ts`, `src/types/events.ts` (occurrence types)

## Key Gotchas

- Completions and exceptions are keyed by the **original** occurrence date/start, which never changes even if the occurrence is moved.
- Keep `recurrence.ts` pure (no Prisma) so it's easy to test.
- Run the `date-logic-reviewer` agent when done.

## Testing

1. `npm test` passes with every case above.
2. To-dos, calendar views show the seeded repeating items on the right days; ticking one day's "Read 20 pages" doesn't tick the others.
3. `npm run build` passes.

## References

- https://github.com/jkbrzt/rrule · https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10
