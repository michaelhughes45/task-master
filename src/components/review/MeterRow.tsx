import { cn } from "@/lib/utils";

const FILL_CLASS = {
  success: "bg-success",
  primary: "bg-primary",
  warning: "bg-warning",
} as const;

interface MeterRowProps {
  label: string;
  // The text value shown next to the label; the bar repeats it visually.
  value: string;
  // 0–100
  percent: number;
  tone: keyof typeof FILL_CLASS;
  mono?: boolean;
}

export function MeterRow({ label, value, percent, tone, mono = true }: MeterRowProps) {
  return (
    <li>
      <div className="flex justify-between gap-3 text-[13.5px]">
        <span className="min-w-0 truncate">{label}</span>
        <span className={cn("flex-none", mono ? "font-mono" : "text-muted-foreground")}>{value}</span>
      </div>
      <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-[4px] bg-muted">
        <div className={cn("h-full rounded-[4px]", FILL_CLASS[tone])} style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}
