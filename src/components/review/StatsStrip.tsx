import { formatMinutes } from "@/lib/dates";
import { rateDelta } from "@/lib/review-view";
import { cn } from "@/lib/utils";
import type { WeeklyReview } from "@/types/review";

interface Stat {
  label: string;
  value: string;
  sub: React.ReactNode;
  subClass?: string;
}

interface StatsStripProps {
  review: WeeklyReview;
  // "Oct 12 – 18"
  previousLabel: string;
}

function completionSub(review: WeeklyReview, previousLabel: string): Pick<Stat, "sub" | "subClass"> {
  const delta = rateDelta(review);
  if (delta === null) return { sub: "No earlier week to compare" };
  if (delta.direction === "same") return { sub: `Same as ${previousLabel}` };
  const up = delta.direction === "up";
  return {
    sub: (
      <>
        <span aria-hidden="true">{up ? "▲" : "▼"} </span>
        <span className="sr-only">{up ? "Up " : "Down "}</span>
        {delta.points} pts vs. {previousLabel}
      </>
    ),
    subClass: up ? "text-success-ink" : "text-warning",
  };
}

export function StatsStrip({ review, previousLabel }: StatsStripProps) {
  const { totals, minutesTracked, done } = review;
  const tracked = done.filter((d) => (d.minutesSpent ?? 0) > 0).length;
  const stats: Stat[] = [
    { label: "Completion", value: `${totals.rate ?? 0}%`, ...completionSub(review, previousLabel) },
    {
      label: "Tasks done",
      value: `${totals.done}/${totals.planned}`,
      sub: `${totals.missed} missed${totals.open > 0 ? ` · ${totals.open} open` : ""}`,
    },
    {
      label: "Time tracked",
      value: formatMinutes(minutesTracked),
      sub: tracked === 0 ? "Nothing logged" : `across ${tracked} ${tracked === 1 ? "task" : "tasks"}`,
    },
    { label: "Done late", value: String(totals.doneLate), sub: "ticked after their day" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card px-4 py-4 md:px-[18px]">
          <dt className="text-[13px] font-medium text-muted-foreground">{stat.label}</dt>
          <dd className="mt-1 font-mono text-[28px] font-semibold tracking-[-0.02em]">{stat.value}</dd>
          <dd className={cn("mt-0.5 text-[13px] text-muted-foreground", stat.subClass)}>{stat.sub}</dd>
        </div>
      ))}
    </dl>
  );
}
