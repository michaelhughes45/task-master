"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItemDialogs } from "@/hooks/use-item-dialogs";

// Phones only: sits above the tab bar. Same action as the header's "New" button.
export function Fab() {
  const { openNew } = useItemDialogs();

  return (
    <Button
      onClick={openNew}
      aria-label="New task or event"
      className="fixed right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 size-14 rounded-2xl shadow-lg shadow-primary/30 md:hidden dark:shadow-black/50"
    >
      <Plus className="size-6" aria-hidden="true" />
    </Button>
  );
}
