"use client";

import { CalendarDays, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoveTaskDialog } from "@/components/todos/MoveTaskDialog";
import type { DateStr } from "@/types/dates";
import type { Priority } from "@/types/tasks";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

function isPriority(value: unknown): value is Priority {
  return PRIORITIES.some((p) => p.value === value);
}

interface TaskRowMenuProps {
  title: string;
  priority: Priority;
  day: DateStr;
  // A repeating task's row asks which occurrences a change is for, which also confirms a delete.
  repeats: boolean;
  disabled?: boolean;
  onRename: () => void;
  onPriorityChange: (priority: Priority) => void;
  onDelete: () => void;
  // Daily tasks only.
  onMove?: (date: DateStr) => void;
}

export function TaskRowMenu({
  title,
  priority,
  day,
  repeats,
  disabled,
  onRename,
  onPriorityChange,
  onDelete,
  onMove,
}: TaskRowMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  // Rename focuses the title input, so the menu mustn't hand focus back to its trigger.
  const renaming = useRef(false);

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) renaming.current = false;
        }}
      >
        <DropdownMenuTrigger
          disabled={disabled}
          aria-label={`Options for ${title}`}
          className="flex size-11 flex-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-expanded:bg-muted md:size-10"
        >
          <EllipsisVertical className="size-[18px]" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44"
          finalFocus={() => !renaming.current}
        >
          <DropdownMenuItem
            className="h-9"
            onClick={() => {
              renaming.current = true;
              onRename();
            }}
          >
            <Pencil aria-hidden="true" />
            Rename
          </DropdownMenuItem>
          {onMove && (
            <DropdownMenuItem className="h-9" onClick={() => setMoveOpen(true)}>
              <CalendarDays aria-hidden="true" />
              Move to…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={priority}
              onValueChange={(value: unknown) => {
                if (isPriority(value) && value !== priority) onPriorityChange(value);
              }}
            >
              {PRIORITIES.map((p) => (
                <DropdownMenuRadioItem key={p.value} value={p.value} closeOnClick className="h-9">
                  {p.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="h-9"
            onClick={() => (repeats ? onDelete() : setConfirmOpen(true))}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{title}&rdquo; will be deleted. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="lg">Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              size="lg"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {onMove && (
        <MoveTaskDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          title={title}
          day={day}
          repeats={repeats}
          onMove={onMove}
        />
      )}
    </>
  );
}
