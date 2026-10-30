"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItemDialogs } from "@/hooks/use-item-dialogs";

// The header's "New" button (md and up); phones use the + button instead.
export function NewItemButton() {
  const { openNew } = useItemDialogs();

  return (
    <Button onClick={openNew} className="hidden h-10 gap-2 pr-4 pl-3 text-[14.5px] font-semibold md:inline-flex">
      <Plus className="size-[18px]" aria-hidden="true" />
      New
    </Button>
  );
}
