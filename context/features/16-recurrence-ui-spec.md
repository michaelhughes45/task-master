# Recurrence — Repeat Options in the Dialog

## Overview

Add Google Calendar-style repeat options to the New/Edit dialog, turn the choice into an RRULE, and show "Repeats …" labels on tasks and events.

## Requirements

- **Repeat select** in the dialog, with presets based on the chosen date (e.g. Wednesday, Oct 28):
  - Daily tasks and events: Does not repeat · Daily · Weekly on Wednesday · Every weekday (Monday to Friday) · Monthly on the fourth Wednesday (or "on the last Wednesday" when it's the last one) · Annually on October 28 · Custom…
  - Weekly-list tasks: Does not repeat · Every week · Every 2 weeks · Custom…
- **Custom panel** (mockup):
  - Repeat every [N] [day | week | month | year]
  - For weeks: weekday chips M T W T F S S (`aria-pressed`, full day names as labels), defaulting to the chosen date's weekday; at least one required
  - For months: "On day 28" or "On the fourth Wednesday"
  - Ends: Never · On [date] · After [N] times (radio group)
  - A live plain-English summary ("Every 2 weeks on Mon, Wed, until Dec 31, 2026")
- `src/lib/rrule-builder.ts` (pure, with tests):
  - `buildRRule(options) → string` and `parseRRule(string) → options` (round-trip)
  - `describeRRule(string, startDay) → string` for labels ("Repeats daily", "Every weekday", "Weekly on Mon, Wed, Fri", "Monthly on the 4th Wednesday")
  - `presetsFor(day, scope)` → the preset list above
- Create/update actions accept the RRULE string and validate it with `rrule`.
- Show the `describeRRule` label in task rows, the event details dialog and the Today schedule meta line.
- Editing a repeating item in this spec changes the whole series (scope choice comes in spec 17).

## Files to Create / Modify

1. `src/lib/rrule-builder.ts` (+ tests)
2. `src/components/items/RepeatSelect.tsx`, `CustomRepeatPanel.tsx`
3. `src/components/items/TaskForm.tsx`, `EventForm.tsx`
4. `src/actions/tasks.ts`, `src/actions/events.ts`, validations

## Testing

1. Builder tests: every preset, custom weekly with several days, monthly by day and by nth weekday, last weekday, until and count; parse(build(x)) == x.
2. Create one of each preset and check the occurrences in the calendar.
3. Labels read naturally. `npm run build` passes.

## References

- `context/mockup/app-desktop.html` (New dialog → Repeat → Custom…)
