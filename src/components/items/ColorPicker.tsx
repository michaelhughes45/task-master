import { EVENT_RING_CLASS, EVENT_SOLID_CLASS } from "@/lib/event-colors";
import { cn } from "@/lib/utils";
import type { EventColor } from "@/types/events";

const COLORS = [
  { value: "BLUE", label: "Blue" },
  { value: "GREEN", label: "Green" },
] as const;

// Round swatches, the chosen one ringed.
export function ColorPicker({ value, onChange }: { value: EventColor; onChange: (color: EventColor) => void }) {
  return (
    <div role="group" aria-label="Color" className="flex items-center gap-1">
      <span aria-hidden="true" className="mr-1.5 text-[13px] font-medium text-muted-foreground">
        Color
      </span>
      {COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          aria-label={color.label}
          aria-pressed={value === color.value}
          onClick={() => onChange(color.value)}
          className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            className={cn(
              "size-7 rounded-full",
              EVENT_SOLID_CLASS[color.value],
              value === color.value && cn("ring-2 ring-offset-2 ring-offset-popover", EVENT_RING_CLASS[color.value]),
            )}
          />
        </button>
      ))}
    </div>
  );
}
