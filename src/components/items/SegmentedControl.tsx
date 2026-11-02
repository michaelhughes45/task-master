import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  // null selects nothing, e.g. before the saved value is known.
  value: T | null;
  onChange: (value: T) => void;
  // "lg" is a little taller on desktop, for settings rows.
  size?: "default" | "lg";
  className?: string;
}

// Toggle buttons with aria-pressed, used in the item forms and the Appearance setting.
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "default",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex gap-0.5 rounded-md bg-muted p-[3px]", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 rounded-[6px] px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:px-3.5",
              size === "lg" ? "md:h-9" : "md:h-8",
              selected
                ? "bg-card font-semibold text-foreground shadow-sm"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
