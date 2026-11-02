"use client";

import { useState } from "react";
import type { EditScope } from "@/lib/recurrence-edit";
import type { DateStr } from "@/types/dates";
import type { Priority, TaskView } from "@/types/tasks";

// A repeating task's changes come with the scope picked for them; a one-off task's without.
export interface TaskRowActions {
  onRename: (title: string, scope?: EditScope) => void;
  onPriorityChange: (priority: Priority, scope?: EditScope) => void;
  onDelete: (scope?: EditScope) => void;
  // Daily tasks only.
  onMove?: (date: DateStr) => void;
}

// A change to a repeating task waiting for its scope.
type PendingChange = { kind: "rename"; title: string } | { kind: "priority"; priority: Priority } | { kind: "delete" };

const SCOPE_PROMPTS = {
  rename: { title: "Rename repeating task", confirmLabel: "Rename", allowThis: true },
  // An occurrence's exception can't hold a priority.
  priority: { title: "Change priority of repeating task", confirmLabel: "Save", allowThis: false },
  delete: { title: "Delete repeating task", confirmLabel: "Delete", allowThis: true },
} as const;

// Rename, priority and delete from a task row: applied straight away for a one-off task, or
// after asking "this / following / all" for a repeating one. Spread `scopeDialog` on an
// EditScopeDialog.
export function useScopedChange(task: TaskView, actions: TaskRowActions | undefined) {
  // Kept after the scope dialog closes, so its text doesn't change while it animates out.
  const [pending, setPending] = useState<PendingChange>({ kind: "delete" });
  const [open, setOpen] = useState(false);

  function apply(next: PendingChange, scope?: EditScope) {
    if (!actions) return;
    if (next.kind === "rename") actions.onRename(next.title, scope);
    else if (next.kind === "priority") actions.onPriorityChange(next.priority, scope);
    else actions.onDelete(scope);
  }

  function change(next: PendingChange) {
    if (!task.repeats) return apply(next);
    setPending(next);
    setOpen(true);
  }

  return {
    change,
    scopeDialog: {
      open,
      onOpenChange: setOpen,
      noun: "task" as const,
      destructive: pending.kind === "delete",
      description: pending.kind === "delete" ? deleteWarning(task) : undefined,
      ...SCOPE_PROMPTS[pending.kind],
      onConfirm: (scope: EditScope) => {
        setOpen(false);
        apply(pending, scope);
      },
    },
  };
}

// Deleting removes completions with their time and notes, so say so before it happens.
function deleteWarning(task: TaskView) {
  const logged = "Time spent and notes logged on the deleted tasks are removed too.";
  return task.done ? `This one is marked done. ${logged}` : logged;
}
