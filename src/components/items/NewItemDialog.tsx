"use client";

import { XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { EventForm } from "@/components/items/EventForm";
import { SegmentedControl } from "@/components/items/SegmentedControl";
import { TaskForm } from "@/components/items/TaskForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { NewItemDefaults } from "@/lib/new-item";
import type { EventDetails } from "@/types/events";

type Kind = "task" | "event";

// A new item opens as a task unless `kind` says otherwise.
export type NewItemTarget =
  | { mode: "new"; kind?: Kind; defaults: NewItemDefaults }
  | { mode: "edit"; event: EventDetails };

const KINDS = [
  { value: "task", label: "Task" },
  { value: "event", label: "Event" },
] as const;

interface NewItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: NewItemTarget | null;
  // Changes on every opening so the forms start fresh.
  formKey: number;
}

// Full-height sheet on phones, a centred dialog from md up.
export function NewItemDialog({ open, onOpenChange, target, formKey }: NewItemDialogProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        initialFocus={titleRef}
        className="inset-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-card p-0 text-foreground ring-0 sm:max-w-none md:inset-auto md:top-16 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-5rem)] md:w-[calc(100%-2rem)] md:max-w-[560px] md:-translate-x-1/2 md:rounded-xl md:ring-1 md:ring-foreground/10"
      >
        {target && (
          <NewItemBody key={formKey} target={target} titleRef={titleRef} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface NewItemBodyProps {
  target: NewItemTarget;
  titleRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}

function NewItemBody({ target, titleRef, onClose }: NewItemBodyProps) {
  const editing = target.mode === "edit" ? target.event : null;
  const [kind, setKind] = useState<Kind>(target.mode === "edit" ? "event" : (target.kind ?? "task"));
  const [title, setTitle] = useState(editing?.form.title ?? "");
  const heading = editing ? "Edit event" : kind === "task" ? "New task" : "New event";
  const formProps = {
    title,
    onTitleChange: setTitle,
    titleRef,
    onCancel: onClose,
    onDone: onClose,
  };

  return (
    <>
      <div className="flex items-center justify-between border-b pt-[calc(14px+env(safe-area-inset-top))] pr-3 pb-3.5 pl-5 md:pt-3.5">
        <DialogTitle className="text-[17px] font-semibold">{heading}</DialogTitle>
        <DialogClose
          render={<Button variant="ghost" size="icon" className="size-11 text-muted-foreground md:size-10" />}
        >
          <XIcon className="size-[18px]" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </div>
      {!editing && (
        <div className="px-5 pt-5">
          <SegmentedControl label="Item type" options={KINDS} value={kind} onChange={setKind} />
        </div>
      )}
      {kind === "task" && target.mode === "new" ? (
        <TaskForm {...formProps} defaultDate={target.defaults.date} />
      ) : (
        <EventForm {...formProps} {...eventFormInitial(target)} />
      )}
    </>
  );
}

function eventFormInitial(target: NewItemTarget) {
  if (target.mode === "edit") {
    return { initial: target.event.form, eventId: target.event.id };
  }
  const { date, startTime, endTime } = target.defaults;
  return {
    initial: {
      date,
      startTime,
      endTime,
      allDay: false,
      location: "",
      notes: "",
      color: "BLUE" as const,
    },
  };
}
