# Today Page

## Overview

Build `/today`, the morning overview: the day's schedule, today's tasks, this week's tasks, and anything still open from earlier in the week, on desktop and phone layouts from the mockup. Also wire up the sidebar's "This week" progress bar.

## Requirements

- Header kicker "Today", title "Wednesday, October 28" (user's timezone).
- **Summary line**: "{done/total} done today · {done/total} weekly done · {n} events today", numbers in mono.
- **Desktop/tablet** (two-column auto-fit grid, `context/mockup/app-desktop.html` Today screen):
  - **Schedule card**: all-day events first, then timed events: start/end times (mono), coloured dot, title, meta line (duration · location · repeat label). Past events muted; the current event gets a "Now" pill. "Open calendar" link. Clicking opens event details. Empty: "No events today."
  - **Today** card, **This week** card: `TaskRow` lists with inline add (reuse spec 09/10 components)
  - **Still open from earlier** card (only when non-empty): this week's past-day tasks not done, each tagged with its day ("Mon, Oct 26"), with "Mark done" (late). Tasks ticked here stay visible as "Done late" until the next page load.
- **Phone** (`context/mockup/today-phone.html`):
  - "Now · until 12:00 PM" card for the current event (or "Next: …" when nothing is on now; hidden when the day is over)
  - Compact schedule list, today's tasks, a "This week: 2 of 5 done · View" row linking to `/todos`, and a "3 missed on Mon and Tue · Review" row linking to `/todos` on the first missed day
- "Now" is computed on the server for the initial render and refreshed on the client every minute.
- **Sidebar "This week"** progress: `done/total` for all daily occurrences + weekly tasks this week, with a green bar (`src/lib/db/progress.ts`).
- Load everything in parallel with `Promise.all`; one query per data type.

## Files to Create / Modify

1. `src/app/(app)/today/page.tsx`
2. `src/components/today/schedule-card.tsx`, `now-card.tsx`, `summary-line.tsx`, `open-earlier-card.tsx`
3. `src/lib/db/progress.ts`, `src/components/layout/app-sidebar.tsx`

## Testing

1. With the seed at 10:40 AM: Gym muted, Deep work has "Now", counts match.
2. Ticking from Today updates the summary and the sidebar progress.
3. Missed items from earlier days appear and can be marked done late.
4. Phone layout matches the phone mockup; nothing is hidden behind the tab bar or FAB.
5. A new user with no data sees friendly empty states. `npm run build` passes.

## References

- `context/mockup/app-desktop.html`, `context/mockup/today-phone.html`
