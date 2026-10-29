# New Task / Event Dialog and Event Details

## Overview

Wire the header "New" button and the phone "+" button to a dialog that creates a task or an event, and add the event details dialog (view, edit, delete) used by the calendar and Today page. No repeat options yet (spec 16).

## Requirements

- **New dialog** (shadcn `dialog`; full-screen sheet on phones), matching the mockup:
  - Segmented **Task | Event** at the top; title "New task" / "New event"
  - Title input (autofocus)
  - Task fields: List (Daily | Weekly), Date (label "Week of" for weekly), Priority (Low / Normal / High)
  - Event fields: Date, Starts, Ends (hidden when All day), All day switch, Location (optional), Color (blue / green swatches with `aria-pressed`)
  - Default date = the date in the current page's `?date=` or today; default event time = next full hour, 1 hour long
  - Footer: Cancel, and "Add task" / "Save event"
  - Uses `createTask` / `createEvent`; shows field errors; closes and toasts on success
- **Event details dialog**: colour square, title, full day, time range + duration, location, notes; buttons Edit and Delete.
  - Edit opens the same form pre-filled ("Edit event") and uses `updateEvent`
  - Delete asks "Delete this event?" then `deleteEvent`
- Dialog state is driven from a small client store or URL param so both the header and pages can open it; pick the simpler option and note it.
- Add shadcn `dialog`, `sheet`, `popover`/`calendar` (date picker) or native date/time inputs. Native inputs are fine on phones; pick one approach and keep it consistent.

## Files to Create / Modify

1. `src/components/items/new-item-dialog.tsx`, `task-form.tsx`, `event-form.tsx`
2. `src/components/events/event-details-dialog.tsx`
3. `src/components/layout/page-header.tsx`, `fab.tsx` (enable the buttons)

## Testing

1. Create a daily task, a weekly task, a timed event and an all-day event; each appears in the database with the right dates/instants for the user's timezone.
2. Validation: empty title, end before start.
3. Edit and delete an event.
4. Phone: the dialog is a full-height sheet; inputs are usable; no layout overflow.
5. Keyboard and screen reader: focus trapped, Escape closes, labels on every input. `npm run build` passes.

## References

- `context/mockup/app-desktop.html` (New dialog, event details dialog)
