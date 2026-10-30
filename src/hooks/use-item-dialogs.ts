"use client";

import { createContext, useContext } from "react";
import type { EventDetails } from "@/types/events";

export interface ItemDialogs {
  // The New task/event dialog, defaulting to the page's ?date= or today.
  openNew: () => void;
  // The details dialog for one event (Edit and Delete live there).
  openEvent: (event: EventDetails) => void;
}

export const ItemDialogsContext = createContext<ItemDialogs | null>(null);

// Provided by ItemDialogsProvider in the (app) layout, so the header, the + button and any
// page can open the dialogs without passing state around.
export function useItemDialogs() {
  const dialogs = useContext(ItemDialogsContext);
  if (!dialogs) throw new Error("useItemDialogs must be used inside ItemDialogsProvider");
  return dialogs;
}
