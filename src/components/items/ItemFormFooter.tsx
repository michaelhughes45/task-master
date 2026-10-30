import { Button } from "@/components/ui/button";

interface ItemFormFooterProps {
  submitLabel: string;
  pending: boolean;
  onCancel: () => void;
}

// Sits under the scrolling form body; clears the home indicator on phones.
export function ItemFormFooter({ submitLabel, pending, onCancel }: ItemFormFooterProps) {
  return (
    <div className="flex justify-end gap-2 border-t bg-background px-5 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] md:pb-3.5">
      <Button type="button" variant="outline" onClick={onCancel} className="h-11 px-4 text-sm md:h-10">
        Cancel
      </Button>
      <Button type="submit" disabled={pending} className="h-11 px-4 text-sm font-semibold md:h-10">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}
