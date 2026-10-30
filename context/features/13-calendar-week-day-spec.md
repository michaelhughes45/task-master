# Calendar — Week and Day Views

## Overview

Build `/calendar` with the week view (default on desktop) and day view (default on phones): a time grid with events positioned by time, an all-day row, the current-time line, and navigation.

## Requirements

- Route `/calendar?view=week|day|month&date=YYYY-MM-DD` (month comes in spec 14; until then it falls back to week).
- **Toolbar**: Today button, previous/next arrows (move by a week or a day), the range label ("Oct 26 – Nov 1, 2026" / "Wednesday, October 28"), and a Day / Week / Month segmented control. All are links, so the back button works.
- **Header row**: day name + date number per column; today's number in a blue circle.
- **All-day row** above the grid when any column has all-day events.
- **Time grid**: full 24 hours at 48px per hour, scrolled so 7 AM is at the top on load (or 1 hour before the first event if earlier). Hour labels in mono in a 56px gutter, hairline hour lines.
- **Events**: absolutely positioned by start/end in the user's timezone; fill `bg-primary-soft text-primary-ink` or `bg-success-soft text-success-ink` by colour; title (semibold, ellipsis) and time (mono, hidden when shorter than 45 minutes). Events crossing midnight are clipped per day.
- **Overlaps**: overlapping events share the column side by side. Put the layout in a pure function, `src/lib/calendar-layout.ts` (`layoutDay(events) → { id, top, height, left%, width% }[]`), with tests.
- **Now line** on today's column: 2px primary line with a dot, updated every minute.
- Clicking an event opens the event details dialog (spec 12). Clicking an empty slot opens the New dialog as an event at that time (rounded down to 30 minutes).
- Phones: default to day view; swipe is not required, the arrows are enough. The week view scrolls horizontally inside its card (min-width 760px).

## Files to Create / Modify

1. `src/app/(app)/calendar/page.tsx`
2. `src/components/calendar/CalendarToolbar.tsx`, `TimeGrid.tsx`, `DayColumn.tsx`, `EventBlock.tsx`, `NowLine.tsx`, `AllDayRow.tsx`
3. `src/lib/calendar-layout.ts` (+ tests)

## Key Gotchas

- Compute pixel positions from wall-clock minutes in the user's timezone, not from UTC instants (DST days have 23 or 25 hours; position by wall time).
- Server-render the grid; only the now line and click handlers need client code.

## Testing

1. Layout tests: no overlap, two overlapping, three in a chain, back-to-back events (not overlapping).
2. Seeded week matches the mockup.
3. Week/day switching, prev/next, Today all update the URL.
4. On Nov 1, 2026 (DST ends in New York) a 9 AM event still sits at 9 AM.
5. 375px day view is usable. `npm run build` passes.

## References

- `context/mockup/app-desktop.html` (Calendar screen)
