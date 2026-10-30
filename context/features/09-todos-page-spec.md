# To-dos Page

## Overview

Build `/todos` from the mockup: a week strip to pick a day, that day's daily list and the week's weekly list, ticking tasks on and off, adding tasks inline, and marking missed tasks done late.

## Requirements

- Route `/todos?date=YYYY-MM-DD` (default: today in the user's timezone; invalid → today). Header kicker "To-dos", title "Week of Oct 26 – Nov 1".
- **Week strip**: 7 buttons (Mon–Sun) as links that set `?date=`; each shows day name, date number and `done/total` in mono. Selected: `border-primary bg-primary-soft`. Today (when not selected): a blue bottom inset bar. Count colour: green-ink when all done, warning when a past day has missed tasks, muted otherwise.
- On a past day, show the muted explanation line from the mockup.
- Two cards in an auto-fit grid (stacking on phones):
  - **Daily**: heading = full day name ("Wednesday, October 28") + "Today"/"Past day" sub-label + `done/total`
  - **This week**: heading + week range + `done/total`
- **`TaskRow`** component (reused by the Today page later):
  - 44px checkbox button with a 20px box: done = green fill with checkmark; not done = muted border; missed = warning border
  - Title (done = muted + line-through), tags line: "Missed" / "Done late" (warning), "High priority" (primary-text), minutes (success-ink, mono)
  - "Mark done" button on missed rows
  - `aria-label` "Mark done: {title}" / "Mark not done: {title}"
- **Ticking** uses `useOptimistic` + the server actions; failures roll back with a toast. Ticking a past day's task records a late completion.
- **Inline add** row at the bottom of each card ("Add a task for Wednesday" / "Add a task for this week"): Enter creates the task, clears the field, and keeps focus. Empty input does nothing.
- **Row menu** (kebab or long-press-free dropdown): Rename (inline edit), Priority (Low/Normal/High), Delete (with undo toast or a confirm).
- Empty states: "Nothing planned for this day." / "No weekly tasks yet."

## Files to Create / Modify

1. `src/app/(app)/todos/page.tsx`
2. `src/components/todos/WeekStrip.tsx`, `TaskListCard.tsx`, `TaskRow.tsx`, `AddTaskInput.tsx`, `TaskRowMenu.tsx`
3. Small additions to `src/actions/tasks.ts` if needed

## Key Gotchas

- Compute "today" and past days with `src/lib/dates.ts` using the user's timezone, not the browser's or server's.
- Keep `TaskRow` free of page-specific logic; pass handlers in so the Today page can reuse it.

## Testing

1. Seeded demo user: counts per day match the seed; past days show missed tasks.
2. Tick/untick updates the count immediately and persists on reload.
3. Ticking a missed task shows "Done late".
4. Add, rename, change priority, delete all work.
5. 375px: strip fits without horizontal scroll; cards stack.
6. Light and dark match the mockup. `npm run build` passes.

## References

- `context/mockup/app-desktop.html` (To-dos screen and the task row template)
