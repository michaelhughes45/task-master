"use client";

import { useId, useState } from "react";
import { ITEM_INPUT_CLASS, ItemField } from "@/components/items/ItemField";
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
import { isDateStr } from "@/lib/dates";
import type { DateStr } from "@/types/dates";

interface MoveTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  day: DateStr;
  // Only this occurrence of a repeating task moves.
  repeats: boolean;
  onMove: (date: DateStr) => void;
}

// The row menu's "Move to…": picks another day for a daily task.
export function MoveTaskDialog({ open, onOpenChange, ...props }: MoveTaskDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* The content unmounts when closed, so each opening starts on the task's day. */}
      <AlertDialogContent>
        <MoveTaskForm {...props} onDone={() => onOpenChange(false)} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MoveTaskForm({
  title,
  day,
  repeats,
  onMove,
  onDone,
}: Omit<MoveTaskDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const id = useId();
  const [date, setDate] = useState<string>(day);
  const canMove = isDateStr(date) && date !== day;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canMove) return;
    onDone();
    onMove(date);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-4">
      <AlertDialogHeader>
        <AlertDialogTitle>Move &ldquo;{title}&rdquo;</AlertDialogTitle>
        <AlertDialogDescription>
          {repeats ? "Only this occurrence moves; the rest of the series stays put." : "Pick the day it's for."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <ItemField id={`${id}-date`} label="Move to">
        <input
          id={`${id}-date`}
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={ITEM_INPUT_CLASS}
        />
      </ItemField>
      <AlertDialogFooter>
        <AlertDialogCancel size="lg">Cancel</AlertDialogCancel>
        <Button type="submit" size="lg" disabled={!canMove}>
          Move
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
