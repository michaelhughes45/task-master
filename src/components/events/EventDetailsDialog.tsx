"use client";

import { MapPin, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteEvent } from "@/actions/events";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EventDetails } from "@/types/events";

interface EventDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventDetails | null;
  onEdit: (event: EventDetails) => void;
  // Changes on every opening so the delete confirmation starts closed.
  formKey: number;
}

export function EventDetailsDialog({ open, onOpenChange, event, onEdit, formKey }: EventDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-24 w-[calc(100%-2rem)] max-w-[440px] translate-y-0 gap-0 overflow-hidden bg-card p-0 text-foreground sm:max-w-[440px]"
      >
        {event && <EventDetailsBody key={formKey} event={event} onEdit={onEdit} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

interface EventDetailsBodyProps {
  event: EventDetails;
  onEdit: (event: EventDetails) => void;
  onClose: () => void;
}

function EventDetailsBody({ event, onEdit, onClose }: EventDetailsBodyProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Event deleted");
      onClose();
    });
  }

  return (
    <>
      <div className="flex items-start gap-3 pt-[18px] pr-3 pb-1.5 pl-5">
        <span
          aria-hidden="true"
          className={cn(
            "mt-[7px] size-3 flex-none rounded-[3px]",
            event.color === "GREEN" ? "bg-success" : "bg-primary",
          )}
        />
        <DialogTitle className="flex-1 text-lg leading-snug font-semibold break-words">{event.title}</DialogTitle>
        <DialogClose
          render={
            <Button variant="ghost" size="icon" className="-mt-2 size-11 flex-none text-muted-foreground md:size-10" />
          }
        >
          <XIcon className="size-[18px]" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </div>
      <DialogDescription render={<div />} className="flex flex-col gap-1.5 pr-5 pb-[18px] pl-[42px] text-sm">
        <span className="text-foreground">{event.dayLabel}</span>
        <span className="font-mono text-[13.5px]">{event.timeLabel}</span>
        {event.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 flex-none" aria-hidden="true" />
            <span className="sr-only">Location: </span>
            {event.location}
          </span>
        )}
        {event.notes && <span className="whitespace-pre-line text-foreground/90">{event.notes}</span>}
      </DialogDescription>
      {confirming && (
        <p role="alert" className="border-t px-5 py-3.5 text-[14.5px] font-semibold">
          Delete this event?
        </p>
      )}
      <div className="flex justify-end gap-2 border-t bg-background px-5 py-3.5">
        {confirming ? (
          <>
            <Button variant="outline" onClick={() => setConfirming(false)} className="h-11 px-4 text-sm md:h-10">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
              className="h-11 px-4 text-sm font-semibold md:h-10"
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => setConfirming(true)}
              className="h-11 px-4 text-sm text-destructive md:h-10"
            >
              Delete
            </Button>
            <Button onClick={() => onEdit(event)} className="h-11 px-4 text-sm font-semibold md:h-10">
              Edit
            </Button>
          </>
        )}
      </div>
    </>
  );
}
