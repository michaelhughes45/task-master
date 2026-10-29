# Date and Timezone Helpers

## Overview

Build `src/lib/dates.ts`, the single place for "today", week boundaries, date strings and display formatting in the user's timezone. Every later feature depends on it, so it gets thorough unit tests. No UI.

## Requirements

- Install `date-fns` and `@date-fns/tz`.
- Conventions (from `context/coding-standards.md`):
  - A **day** is a `YYYY-MM-DD` string (`DateStr` type). Prisma `@db.Date` values convert to/from it via UTC, never local time.
  - An **instant** is a UTC `Date`.
  - Weeks run **Monday–Sunday**; a week is identified by its Monday's `DateStr`.
- Functions (names can change if clearer; keep them small and pure, taking `tz` explicitly):
  - `resolveTimezone(user)` → the user's IANA zone, or `'UTC'` when null
  - `todayIn(tz, now?)` → `DateStr`
  - `weekStartOf(day)` → Monday `DateStr`; `weekDays(weekStart)` → 7 `DateStr`s; `addDays(day, n)`, `addWeeks(day, n)`
  - `isBefore(dayA, dayB)`, `isPastDay(day, tz, now?)`
  - `dayStartInstant(day, tz)`, `dayEndInstant(day, tz)` (exclusive end, next day's start) and `weekRange(weekStart, tz)` for queries
  - `toDbDate(day)` / `fromDbDate(date)` for `@db.Date`
  - `wallTimeToInstant(day, 'HH:mm', tz)` / `instantToWallTime(instant, tz)`
  - `isDoneLate({ occurrenceDay, scope: 'DAILY' | 'WEEKLY', completedAt, tz })`
  - Formatters: `formatDayLong` ("Wednesday, October 28"), `formatDayShort` ("Wed, Oct 28"), `formatWeekRange` ("Oct 26 – Nov 1", across years "Dec 28, 2026 – Jan 3, 2027"), `formatTime` ("9:00 AM"), `formatMinutes` ("25 min", "2h 10m", "1h")
  - `parseDateParam(value, fallback)` for `?date=` search params (invalid → fallback)
- `src/lib/dates.test.ts` covering at least:
  - `America/New_York` around **Mar 8, 2026** (spring forward) and **Nov 1, 2026** (fall back): day ranges are 23/25 hours, wall times stay correct
  - A zone ahead of UTC (`Pacific/Auckland`) and one behind (`America/Los_Angeles`) late at night: "today" differs from UTC's
  - Week start for a Sunday, a Monday, and across month and year boundaries (Dec 28, 2026 – Jan 3, 2027)
  - Leap day 2028-02-29
  - `isDoneLate` for daily (ticked the next morning) and weekly (ticked Monday after)
  - `formatMinutes` edge cases (0, 59, 60, 61, 130)
- Pin the clock with `vi.setSystemTime` where "now" matters.

## Files to Create

1. `src/lib/dates.ts`
2. `src/lib/dates.test.ts`
3. `src/types/dates.ts` (`DateStr`, `WallTime`) if helpful

## Key Gotchas

- Never move by days with milliseconds; use date-fns on `TZDate` or calendar math on `DateStr`.
- Vercel runs in UTC; tests must not depend on the machine's timezone. Set `TZ=Pacific/Auckland` (not UTC) in the Vitest config so code that accidentally uses local time fails instead of passing by luck.

## Testing

1. `npm test` passes, including every case above.
2. Run the `date-logic-reviewer` agent on `src/lib/dates.ts` and fix real findings.

## References

- https://github.com/date-fns/tz
