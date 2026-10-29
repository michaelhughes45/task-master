# Calendar — Month View

## Overview

Add the month view to `/calendar`: a Monday-start grid with event chips per day.

## Requirements

- `view=month`: grid of 5 or 6 weeks starting on the Monday on or before the 1st and ending on the Sunday on or after the last day.
- Weekday header row (Mon … Sun).
- Each cell: date number (today in a blue circle), up to 2 event chips (coloured dot + title, ellipsis; all-day first, then by start time), then "+N more" when there are more.
- Days outside the month have the page background and muted text.
- Clicking a day number or "+N more" goes to that day's day view. Clicking a chip opens the event details dialog.
- Toolbar label "October 2026"; previous/next move by a month; Today returns to the current month.
- Load events for the whole visible range in one query.
- Min-width 640px with horizontal scroll inside the card on phones.

## Files to Create / Modify

1. `src/components/calendar/month-grid.tsx`, `month-cell.tsx`
2. `src/app/(app)/calendar/page.tsx`
3. `src/lib/dates.ts`: `monthGridRange(day)` (+ tests: a month starting on Monday, one starting on Sunday, February 2027, a 6-week month)

## Testing

1. Grid ranges correct for the test months.
2. Chips and "+N more" match the seeded data.
3. Navigation and links to the day view work. `npm run build` passes.

## References

- `context/mockup/app-desktop.html` (Calendar → Month)
