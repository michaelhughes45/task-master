"use client";

import { useId, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { CompletionDetails } from "@/hooks/use-task-list";
import { cn } from "@/lib/utils";
import { MAX_MINUTES, completionDetailsSchema } from "@/lib/validations/tasks";
import type { TaskView } from "@/types/tasks";

interface TaskDetailsPanelProps {
  task: TaskView;
  // Focus the minutes field on open (when opened from the clock button, not from a tick).
  autoFocus: boolean;
  onSave: (details: CompletionDetails) => void;
  onClose: () => void;
}

type FieldErrors = Partial<Record<keyof CompletionDetails, string>>;

// Fields start with the saved values so they can be changed or cleared. Enter saves; Escape closes.
export function TaskDetailsPanel({ task, autoFocus, onSave, onClose }: TaskDetailsPanelProps) {
  const id = useId();
  const [minutes, setMinutes] = useState(task.minutesSpent?.toString() ?? "");
  const [note, setNote] = useState(task.workNote ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});

  function save() {
    const parsed = completionDetailsSchema.safeParse({
      minutesSpent: minutes.trim() === "" ? null : Number(minutes),
      workNote: note,
    });
    if (!parsed.success) {
      const { fieldErrors } = z.flattenError(parsed.error);
      setErrors({ minutesSpent: fieldErrors.minutesSpent?.[0], workNote: fieldErrors.workNote?.[0] });
      return;
    }
    onSave({ minutesSpent: parsed.data.minutesSpent ?? null, workNote: parsed.data.workNote ?? null });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Enter" && e.target instanceof HTMLInputElement && !e.nativeEvent.isComposing) {
      e.preventDefault();
      save();
    }
  }

  const minutesError = `${id}-minutes-error`;
  const noteError = `${id}-note-error`;

  return (
    <div
      role="group"
      aria-label={`Time spent and notes for ${task.title}`}
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-end gap-x-3 gap-y-2.5 pt-0.5 pr-4 pb-3.5 pl-4 sm:pl-12"
    >
      <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
        Time spent (min)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_MINUTES}
          step={1}
          autoFocus={autoFocus}
          value={minutes}
          placeholder="e.g. 30"
          aria-invalid={errors.minutesSpent ? true : undefined}
          aria-describedby={errors.minutesSpent ? minutesError : undefined}
          onChange={(e) => {
            setMinutes(e.target.value);
            setErrors((prev) => ({ ...prev, minutesSpent: undefined }));
          }}
          className={inputClass("w-[110px]")}
        />
      </label>
      <label className="flex flex-[1_1_200px] flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
        What I worked on
        <input
          type="text"
          value={note}
          placeholder="Optional note"
          aria-invalid={errors.workNote ? true : undefined}
          aria-describedby={errors.workNote ? noteError : undefined}
          onChange={(e) => {
            setNote(e.target.value);
            setErrors((prev) => ({ ...prev, workNote: undefined }));
          }}
          className={inputClass("w-full")}
        />
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="h-11 px-3 text-sm md:h-9">
          Skip
        </Button>
        <Button type="button" onClick={save} className="h-11 px-3.5 text-sm font-semibold md:h-9">
          Save
        </Button>
      </div>
      {(errors.minutesSpent || errors.workNote) && (
        <div className="flex basis-full flex-col gap-0.5 text-[12.5px] text-destructive">
          {errors.minutesSpent && <p id={minutesError}>Time spent: {errors.minutesSpent}</p>}
          {errors.workNote && <p id={noteError}>What I worked on: {errors.workNote}</p>}
        </div>
      )}
      <p className="basis-full text-[12.5px] text-muted-foreground">Both are optional.</p>
    </div>
  );
}

function inputClass(width: string) {
  return cn(
    width,
    "h-11 rounded-md border border-input bg-background px-2.5 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:h-9",
  );
}
