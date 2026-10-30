import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Phones only: sits above the tab bar. Same action as the header's "New" button (spec 12).
export function Fab() {
  return (
    <Button
      disabled
      aria-label="New task or event"
      className="fixed right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 size-14 rounded-2xl shadow-lg shadow-primary/30 md:hidden dark:shadow-black/50"
    >
      <Plus className="size-6" aria-hidden="true" />
    </Button>
  );
}
