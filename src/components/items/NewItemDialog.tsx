"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { NewItemDefaults } from "@/lib/new-item";
import type { EventDetails } from "@/types/events";

export type Kind = "task" | "event";

// Kept out of every page's first download, then fetched shortly after the page loads so it's
// usually there before the first click (and the title field can take focus on open).
const loadBody = () => import("@/components/items/NewItemBody");
const NewItemBody = dynamic(loadBody, { ssr: false });
const PRELOAD_DELAY_MS = 2000;

// A new item opens as a task unless `kind` says otherwise.
export type NewItemTarget =
  | { mode: "new"; kind?: Kind; defaults: NewItemDefaults }
  | { mode: "edit"; event: EventDetails };

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

  useEffect(() => {
    const timer = setTimeout(() => void loadBody(), PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

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
