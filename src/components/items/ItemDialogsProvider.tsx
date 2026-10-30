"use client";

import { useMemo, useState } from "react";
import { EventDetailsDialog } from "@/components/events/EventDetailsDialog";
import { NewItemDialog, type NewItemTarget } from "@/components/items/NewItemDialog";
import { ItemDialogsContext, type ItemDialogs } from "@/hooks/use-item-dialogs";
import { newItemDefaults } from "@/lib/new-item";
import type { EventDetails } from "@/types/events";

interface DialogState<T> {
  open: boolean;
  // Kept after closing so the content doesn't vanish during the close animation.
  value: T | null;
  key: number;
}

const CLOSED = { open: false, value: null, key: 0 };

function opened<T>(value: T) {
  return (prev: DialogState<T>): DialogState<T> => ({
    open: true,
    value,
    key: prev.key + 1,
  });
}

function closed<T>(prev: DialogState<T>): DialogState<T> {
  return { ...prev, open: false };
}

// A small client store instead of a URL param: opening a dialog then needs no navigation or
// server render, and any client component under the (app) layout can open one.
export function ItemDialogsProvider({ timezone, children }: { timezone: string; children: React.ReactNode }) {
  const [newItem, setNewItem] = useState<DialogState<NewItemTarget>>(CLOSED);
  const [details, setDetails] = useState<DialogState<EventDetails>>(CLOSED);

  const dialogs = useMemo<ItemDialogs>(
    () => ({
      // Read at click time, so the date follows the current page and "now" is never stale.
      openNew: () =>
        setNewItem(
          opened<NewItemTarget>({
            mode: "new",
            defaults: newItemDefaults(window.location.search, timezone),
          }),
        ),
      openEvent: (event) => setDetails(opened(event)),
    }),
    [timezone],
  );

  function editEvent(event: EventDetails) {
    setDetails(closed);
    setNewItem(opened<NewItemTarget>({ mode: "edit", event }));
  }

  return (
    <ItemDialogsContext value={dialogs}>
      {children}
      <NewItemDialog
        open={newItem.open}
        onOpenChange={(open) => !open && setNewItem(closed)}
        target={newItem.value}
        formKey={newItem.key}
      />
      <EventDetailsDialog
        open={details.open}
        onOpenChange={(open) => !open && setDetails(closed)}
        event={details.value}
        onEdit={editEvent}
        formKey={details.key}
      />
    </ItemDialogsContext>
  );
}
