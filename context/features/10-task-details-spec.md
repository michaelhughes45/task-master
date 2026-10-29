# Task Details — Time Spent and Notes

## Overview

Let the user record how long a task took and what they worked on. The prompt appears inline right after ticking a task, can be skipped, and can be reopened later from a clock button.

## Requirements

- In `TaskRow`:
  - After ticking a task done, expand an inline panel under the row with:
    - "Time spent (min)" number input (placeholder: existing value or "e.g. 30")
    - "What I worked on" text input
    - Skip and Save buttons, and the muted hint "Both are optional."
  - A clock icon button on every row (`aria-label` "Time spent and notes for {title}") toggles the panel.
  - Saving a not-done task marks it done as well.
  - Only one row's panel is open at a time per list.
  - Enter in either input saves; Escape closes.
- Show saved details on the row: minutes as a mono success-ink tag ("45 min", "2h 10m"), the note in a small sunken box under the title.
- Use `saveCompletionDetails` from spec 08; validate 0–1440 minutes and ≤ 500 characters, with inline errors.
- Unticking a task asks nothing but clears its details (the completion row is deleted). Show an undo toast so details aren't lost by accident.

## Files to Create / Modify

1. `src/components/todos/task-row.tsx`
2. `src/components/todos/task-details-panel.tsx`

## Testing

1. Tick → panel opens → Save 45 + note → tag and note shown, persisted.
2. Tick → Skip → no details, still done.
3. Clock on an undone task → Save → task becomes done with details.
4. Untick → undo restores the details.
5. Keyboard: Tab order, Enter saves, Escape closes. `npm run build` passes.

## References

- `context/mockup/app-desktop.html` (expanded row panel)
