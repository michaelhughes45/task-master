"use client";

import { useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { EditScope } from "@/lib/recurrence-edit";

type Noun = "event" | "task";

function scopeLabels(noun: Noun): { value: EditScope; label: string }[] {
  return [
    { value: "this", label: `This ${noun}` },
    { value: "following", label: `This and following ${noun}s` },
    { value: "all", label: `All ${noun}s` },
  ];
}

interface EditScopeOptionsProps {
  legend: string;
  noun: Noun;
  value: EditScope;
  onChange: (scope: EditScope) => void;
  // False when the change can't be made to one occurrence (its repeat, color or priority).
  allowThis?: boolean;
  // When a dialog title already says it.
  hideLegend?: boolean;
}

// The mockup's "Delete repeating event" radio group.
export function EditScopeOptions({
  legend,
  noun,
  value,
  onChange,
  allowThis = true,
  hideLegend,
}: EditScopeOptionsProps) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className={hideLegend ? "sr-only" : "mb-2 text-[14.5px] font-semibold"}>{legend}</legend>
      {scopeLabels(noun)
        .filter((option) => allowThis || option.value !== "this")
        .map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-2.5 text-sm md:min-h-9">
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 flex-none accent-primary"
            />
            {option.label}
          </label>
        ))}
    </fieldset>
  );
}

interface EditScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // "Edit repeating event", "Delete repeating task"
  title: string;
  noun: Noun;
  confirmLabel: string;
  // What else the change does, such as a delete removing logged time.
  description?: string;
  destructive?: boolean;
  allowThis?: boolean;
  onConfirm: (scope: EditScope) => void;
}

// Asks which occurrences of a repeating item a change is for. Starts on "This one", or on
// "This and following" when one occurrence can't take the change.
export function EditScopeDialog({ open, onOpenChange, ...props }: EditScopeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* The content unmounts when closed, so each opening starts on the default scope. */}
      <AlertDialogContent>
        <EditScopeBody {...props} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditScopeBody({
  title,
  noun,
  confirmLabel,
  description,
  destructive,
  allowThis = true,
  onConfirm,
}: Omit<EditScopeDialogProps, "open" | "onOpenChange">) {
  const [scope, setScope] = useState<EditScope>(allowThis ? "this" : "following");

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
      </AlertDialogHeader>
      <EditScopeOptions legend={title} noun={noun} value={scope} onChange={setScope} allowThis={allowThis} hideLegend />
      <AlertDialogFooter>
        <AlertDialogCancel size="lg">Cancel</AlertDialogCancel>
        <Button variant={destructive ? "destructive" : "default"} size="lg" onClick={() => onConfirm(scope)}>
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  );
}
