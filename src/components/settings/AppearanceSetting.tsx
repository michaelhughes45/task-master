"use client";

import { cn } from "cn";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/use-mounted";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

// Same next-themes value as the header toggle, so the two always agree.
export function AppearanceSetting() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div role="group" aria-label="Theme" className="inline-flex gap-0.5 rounded-md bg-muted p-[3px]">
      {OPTIONS.map(({ value, label }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "h-9 rounded-[6px] px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "bg-card font-semibold text-foreground shadow-sm"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
