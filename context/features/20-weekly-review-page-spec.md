# Weekly Review Page

## Overview

Build `/review` and `/review/[weekStart]` from the mockup, showing the numbers from spec 19 with a list of past weeks.

## Requirements

- `/review` shows the most recent **completed** week (last Monday–Sunday before the current week). On Sunday from 7 PM, it shows the current week instead (it's "ready"). `/review/[weekStart]` shows any week; invalid or non-Monday dates redirect to the right Monday.
- Header kicker "Weekly review", title "Week of Oct 19 – 25".
- **Weeks list** (left on desktop, a select/horizontal list on phones): the last 12 weeks with their completion rate in mono; the selected week uses the primary-soft style. Under it: "This week's review is ready Sunday, Nov 1 at 7:00 PM."
- **Summary sentence**: "You finished 28 of 36 tasks (78%), up from 72% the week before, and tracked 14h 20m of work. 3 tasks were ticked off late." (adjust wording when there's no previous week or no time tracked).
- **Stats strip** (hairline grid): Completion (with ▲/▼ points vs. last week in success-ink/warning), Tasks done, Time tracked, Done late.
- **Day by day** bar chart (CSS, no chart library): planned track in sunken, done fill in green, label and `done/planned` under each bar; legend.
- **Daily and weekly lists** split bars, **Time by task** bars (primary).
- **Missed** and **Done late** lists; **Most-missed repeating tasks** with warning bars and the hint line; **What you worked on** notes.
- Empty state for a week with nothing planned, and for new users: "Your first review will be ready on Sunday."
- Accessible: bars have text values next to them; colour isn't the only signal.

## Files to Create / Modify

1. `src/app/(app)/review/page.tsx`, `src/app/(app)/review/[weekStart]/page.tsx`
2. `src/components/review/*` (weeks-list, summary, stats-strip, day-bars, split-bars, time-by-task, missed-list, late-list, most-missed, notes-list)

## Testing

1. Seeded previous week renders like the mockup.
2. Ticking a past task late, then reloading the review, updates its numbers.
3. Week switching via the list updates the URL.
4. Phone layout readable with no horizontal scroll; light and dark both correct. `npm run build` passes.

## References

- `context/mockup/app-desktop.html` (Weekly review screen)
