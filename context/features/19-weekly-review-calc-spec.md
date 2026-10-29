# Weekly Review — Calculations

## Overview

Build the weekly review numbers as a pure, tested function, plus the query that feeds it. No UI (spec 20).

## Requirements

- `src/lib/review.ts`: `computeWeeklyReview(input) → WeeklyReview`, pure. Input: the week's task occurrences (daily and weekly, after recurrence and exceptions), their completions, the previous week's occurrences and completions, and the user's timezone.
- Definitions:
  - **Planned** = non-cancelled occurrences in the week: each daily occurrence counts once; each weekly task counts once for the week
  - **Done** = planned occurrences with a completion (on time or late); **missed** = planned − done
  - **Completion rate** = done / planned, rounded to a whole percent; `null` when planned is 0
  - **Daily rate** and **weekly rate** separately
  - **Done late** = completions where `isDoneLate` is true
  - **Time tracked** = sum of `minutesSpent`; **time by task** grouped by task id (series), top 5
  - **Per day**: planned and done daily occurrences for Mon–Sun (weekly tasks are not in the bars)
  - **Most-missed repeating tasks**: repeating tasks with at least one miss, by missed count then miss ratio, top 3, with "missed X of Y"
  - **Notes**: completions with a `workNote`, in date order, with day, task title and minutes
  - **Compared with last week**: change in completion rate (percentage points) and time tracked
- `src/lib/db/review.ts`: `getWeeklyReview(userId, weekStart, tz)` loads both weeks (using the recurrence-aware queries) and calls `computeWeeklyReview`. Also `getReviewWeeks(userId, tz)` → the last 12 week starts that have any planned tasks, newest first.
- Types in `src/types/review.ts`.

## Files to Create / Modify

1. `src/lib/review.ts` (+ `review.test.ts`)
2. `src/lib/db/review.ts`
3. `src/types/review.ts`

## Testing

1. Unit tests: empty week (rate null), all done, mixed with late completions, weekly tasks counted once, cancelled occurrences excluded, repeating task missed 3 of 7, previous week missing (no comparison), minutes summed with nulls.
2. Run against the seed for the previous week and sanity-check the numbers.
3. Run the `date-logic-reviewer` agent. `npm run build` passes.
