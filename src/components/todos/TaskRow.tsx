"use client";

import { Check, Clock3 } from "lucide-react";
import { useRef, useState } from "react";
import { EditScopeDialog } from "@/components/items/EditScopeDialog";
import { TaskDetailsPanel } from "@/components/todos/TaskDetailsPanel";
import { TaskRowMenu } from "@/components/todos/TaskRowMenu";
import { Button } from "@/components/ui/button";
import type { CompletionDetails } from "@/hooks/use-task-list";
import { formatMinutes } from "@/lib/dates";
import type { EditScope } from "@/lib/recurrence-edit";
import { cn } from "@/lib/utils";
import type { DateStr } from "@/types/dates";
import type { Priority, TaskView } from "@/types/tasks";

// A repeating task's changes come with the scope picked for them; a one-off task's without.
interface TaskRowActions {
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

interface TaskRowDetails {
  open: boolean;
  // Focus the panel's first field when it opens.
  autoFocus: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSave: (details: CompletionDetails) => void;
}

interface TaskRowProps {
  task: TaskView;
  // The task's day or week has ended and it isn't done.
  missed: boolean;
  // While the task is still being created.
  disabled?: boolean;
  onToggle: () => void;
  // Shows the row menu when given.
  actions?: TaskRowActions;
  // Shows the clock button and the time spent / notes panel.
  details: TaskRowDetails;
}

export function TaskRow({ task, missed, disabled, onToggle, actions, details }: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  // Kept after the scope dialog closes, so its text doesn't change while it animates out.
  const [pending, setPending] = useState<PendingChange>({ kind: "delete" });
  const [scopeOpen, setScopeOpen] = useState(false);
  const clockRef = useRef<HTMLButtonElement>(null);

  function change(next: PendingChange) {
    if (!task.repeats) return apply(next);
    setPending(next);
    setScopeOpen(true);
  }

  function apply(next: PendingChange, scope?: EditScope) {
    if (!actions) return;
    if (next.kind === "rename") actions.onRename(next.title, scope);
    else if (next.kind === "priority") actions.onPriorityChange(next.priority, scope);
    else actions.onDelete(scope);
  }

  function closeDetails(save?: CompletionDetails) {
    if (save) details.onSave(save);
    details.onClose();
    clockRef.current?.focus();
  }

  return (
    <li className="border-t">
      <div className="flex items-center gap-0.5 py-0.5 pr-2 pl-1">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={`${task.done ? "Mark not done" : "Mark done"}: ${task.title}`}
          className="flex size-11 flex-none items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-[5px] border-[1.5px]",
              task.done
                ? "border-success bg-success text-success-foreground"
                : missed
                  ? "border-warning"
                  : "border-muted-foreground",
            )}
          >
            {task.done && <Check className="size-[13px]" strokeWidth={3.2} aria-hidden="true" />}
          </span>
        </button>

        <div className="min-w-0 flex-1 py-2">
          {editing && actions ? (
            <RenameInput
              title={task.title}
              onDone={(title) => {
                setEditing(false);
                if (title && title !== task.title) change({ kind: "rename", title });
              }}
            />
          ) : (
            <div className={cn("break-words", task.done ? "text-muted-foreground line-through" : "font-medium")}>
              {task.title}
            </div>
          )}
          <TaskTags task={task} missed={missed} />
          {task.done && task.workNote && (
            <p className="mt-1.5 rounded-md bg-muted px-2.5 py-1.5 text-[13px] break-words text-muted-foreground">
              {task.workNote}
            </p>
          )}
        </div>

        {missed && (
          <Button
            variant="outline"
            onClick={onToggle}
            disabled={disabled}
            aria-label={`Mark done late: ${task.title}`}
            className="relative h-8 flex-none px-2.5 text-[13px] after:absolute after:-inset-y-1.5 after:inset-x-0"
          >
            Mark done
          </Button>
        )}

        <button
          ref={clockRef}
          type="button"
          onClick={details.onToggle}
          disabled={disabled}
          aria-label={`Time spent and notes for ${task.title}`}
          aria-expanded={details.open}
          title="Time spent and notes"
          className="flex size-11 flex-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-expanded:bg-muted md:size-10"
        >
          <Clock3 className="size-[17px]" strokeWidth={1.8} aria-hidden="true" />
        </button>

        {actions && (
          <TaskRowMenu
            title={task.title}
            priority={task.priority}
            day={task.day}
            repeats={task.repeats}
            disabled={disabled}
            onRename={() => setEditing(true)}
            onPriorityChange={(priority) => change({ kind: "priority", priority })}
            onDelete={() => change({ kind: "delete" })}
            onMove={actions.onMove}
          />
        )}
        <EditScopeDialog
          open={scopeOpen}
          onOpenChange={setScopeOpen}
          noun="task"
          destructive={pending.kind === "delete"}
          description={pending.kind === "delete" ? deleteWarning(task) : undefined}
          {...SCOPE_PROMPTS[pending.kind]}
          onConfirm={(scope) => {
            setScopeOpen(false);
            apply(pending, scope);
          }}
        />
      </div>
      {details.open && (
        <TaskDetailsPanel
          task={task}
          autoFocus={details.autoFocus}
          onSave={closeDetails}
          onClose={() => closeDetails()}
        />
      )}
    </li>
  );
}

function TaskTags({ task, missed }: { task: TaskView; missed: boolean }) {
  const minutes = task.done && task.minutesSpent ? task.minutesSpent : null;
  if (!missed && !task.doneLate && task.priority !== "HIGH" && minutes === null && !task.repeatLabel) return null;

  return (
    <div className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
      {missed && <span className="font-medium text-warning">Missed</span>}
      {task.doneLate && <span className="font-medium text-warning">Done late</span>}
      {task.priority === "HIGH" && <span className="font-medium text-primary-text">High priority</span>}
      {task.repeatLabel && <span>{task.repeatLabel}</span>}
      {minutes !== null && (
        <span className="font-mono text-[12.5px] text-success-ink">{formatMinutes(minutes)}</span>
      )}
    </div>
  );
}

// Deleting removes completions with their time and notes, so say so before it happens.
function deleteWarning(task: TaskView) {
  const logged = "Time spent and notes logged on the deleted tasks are removed too.";
  return task.done ? `This one is marked done. ${logged}` : logged;
}

// Enter or leaving the field saves; Escape cancels.
function RenameInput({ title, onDone }: { title: string; onDone: (title: string | null) => void }) {
  const finished = useRef(false);

  function finish(value: string | null) {
    if (finished.current) return;
    finished.current = true;
    onDone(value);
  }

  return (
    <input
      type="text"
      autoFocus
      defaultValue={title}
      maxLength={200}
      aria-label={`Rename ${title}`}
      onBlur={(e) => finish(e.currentTarget.value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(e.currentTarget.value.trim());
        } else if (e.key === "Escape") {
          finish(null);
        }
      }}
      className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
}
