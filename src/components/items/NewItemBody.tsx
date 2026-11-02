"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import { EventForm } from "@/components/items/EventForm";
import type { Kind, NewItemTarget } from "@/components/items/NewItemDialog";
import { SegmentedControl } from "@/components/items/SegmentedControl";
import { TaskForm } from "@/components/items/TaskForm";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogTitle } from "@/components/ui/dialog";

const KINDS = [
  { value: "task", label: "Task" },
  { value: "event", label: "Event" },
] as const;

interface NewItemBodyProps {
  target: NewItemTarget;
  titleRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}

// Loaded when the dialog first opens: the forms bring the repeat controls, rrule and the Zod schemas.
export default function NewItemBody({ target, titleRef, onClose }: NewItemBodyProps) {
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
    const { form, id, occurrenceStart } = target.event;
    return { initial: form, eventId: id, occurrenceStart };
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
      rrule: null,
    },
  };
}
