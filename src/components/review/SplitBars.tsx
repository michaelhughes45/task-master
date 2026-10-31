import { MeterRow } from "@/components/review/MeterRow";
import type { ReviewRate } from "@/types/review";

// Completion of the daily and weekly lists, side by side.
export function SplitBars({ daily, weekly }: { daily: ReviewRate; weekly: ReviewRate }) {
  const rows = [
    { label: "Daily tasks", rate: daily },
    { label: "Weekly tasks", rate: weekly },
  ];
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map(({ label, rate }) => (
        <MeterRow
          key={label}
          label={label}
          value={rate.rate === null ? "None planned" : `${rate.rate}%`}
          mono={rate.rate !== null}
          percent={rate.rate ?? 0}
          tone="success"
        />
      ))}
    </ul>
  );
}
