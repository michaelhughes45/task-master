"use client";

import { useTheme } from "next-themes";
import { SegmentedControl } from "@/components/items/SegmentedControl";
import { useMounted } from "@/hooks/use-mounted";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

type Theme = (typeof OPTIONS)[number]["value"];

// Same next-themes value as the header toggle, so the two always agree. Nothing is selected
// until mounted, since the server doesn't know the saved theme.
export function AppearanceSetting() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const value = mounted && OPTIONS.some((option) => option.value === theme) ? (theme as Theme) : null;

  return <SegmentedControl label="Theme" options={OPTIONS} value={value} onChange={setTheme} size="lg" />;
}
