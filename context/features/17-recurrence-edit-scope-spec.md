# Recurrence — This One, This and Following, or All

## Overview

When editing or deleting one occurrence of a repeating task or event, ask whether the change applies to **this one only**, **this and following**, or **all**, and apply it correctly with exceptions or by splitting the series.

## Requirements

- Scope prompt (radio group, mockup's "Delete repeating event" dialog) shown when saving an edit or confirming a delete on a repeating item. Options: This event/task · This and following · All.
- `src/lib/recurrence-edit.ts` (pure, with tests) decides what to write:
  - **This one, edit**: upsert an exception with the overrides for that occurrence
  - **This one, delete**: upsert an exception with `cancelled: true`
  - **This and following, edit**: end the original series the occurrence before (`UNTIL` = previous occurrence; or delete the series if it's the first occurrence) and create a new series starting at this occurrence with the new values. Move later exceptions and completions to the new series where they still match.
  - **This and following, delete**: end the series the occurrence before
  - **All, edit**: update the series; keep exceptions whose occurrences still exist, drop the rest
  - **All, delete**: delete the series (cascades exceptions and completions)
- Server actions `updateOccurrence` / `deleteOccurrence` for tasks and events, run in a Prisma transaction.
- Moving a single task occurrence to another day (via the row menu "Move to…" date picker) uses "this one" with a `date` override.
- Completions stay keyed by the original occurrence date.

## Files to Create / Modify

1. `src/lib/recurrence-edit.ts` (+ tests)
2. `src/actions/tasks.ts`, `src/actions/events.ts`
3. `src/components/items/edit-scope-dialog.tsx`
4. `src/components/events/event-details-dialog.tsx`, `src/components/todos/task-row-menu.tsx`

## Key Gotchas

- "This and following" on the very first occurrence equals "All".
- An `UNTIL` must be expressed in the same floating-time convention as the series (spec 15).
- Run the `date-logic-reviewer` agent when done.

## Testing

1. Unit tests for each of the six cases, including the first-occurrence edge case and a series with `COUNT`.
2. In the app: cancel one gym session; change the time of all future Spanish classes; delete the deep work series. Check the calendar and to-dos after each.
3. Completions from before a split are kept. `npm run build` passes.
