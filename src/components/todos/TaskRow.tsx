"use client";

import { Check, Clock3 } from "lucide-react";
import { useRef, useState } from "react";
import { EditScopeDialog } from "@/components/items/EditScopeDialog";
import { RenameInput } from "@/components/todos/RenameInput";
import { TaskDetailsPanel } from "@/components/todos/TaskDetailsPanel";
import { TaskRowMenu } from "@/components/todos/TaskRowMenu";
import { TaskTags } from "@/components/todos/TaskTags";
import { Button } from "@/components/ui/button";
import { useScopedChange, type TaskRowActions } from "@/hooks/use-scoped-change";
import type { CompletionDetails } from "@/hooks/use-task-list";
import { cn } from "@/lib/utils";
import type { TaskView } from "@/types/tasks";

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
  // "Mon, Oct 26", first among the tags, for lists that mix days.
  dayLabel?: string;
  onToggle: () => void;
  // Shows the row menu when given.
  actions?: TaskRowActions;
  // Shows the clock button and the time spent / notes panel.
  details: TaskRowDetails;
}

export function TaskRow({ task, missed, disabled, dayLabel, onToggle, actions, details }: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const { change, scopeDialog } = useScopedChange(task, actions);
  const clockRef = useRef<HTMLButtonElement>(null);

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
          <TaskTags task={task} missed={missed} dayLabel={dayLabel} />
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
            // Full 44px on phones; smaller on desktop with the hit area enlarged instead.
            className="relative mr-1 h-11 flex-none px-3 text-[13px] md:h-8 md:px-2.5 md:after:absolute md:after:-inset-y-1.5 md:after:inset-x-0"
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
        <EditScopeDialog {...scopeDialog} />
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
