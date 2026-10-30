import { nowAndNext, type ScheduleItem } from "@/lib/today";

interface NowCardProps {
  items: ScheduleItem[];
  now: number;
}

// Phones: the event on now and the next one, or just the next one. Nothing once the day's
// events are over.
export function NowCard({ items, now }: NowCardProps) {
  const { current, next } = nowAndNext(items, now);
  if (!current && !next) return null;

  return (
    <section aria-label={current ? "Happening now" : "Up next"} className="rounded-xl bg-primary-soft px-4 py-3.5 text-primary-ink md:hidden">
      <p className="text-[12.5px] font-semibold tracking-[0.04em] uppercase">
        {current ? `Now · until ${current.endLabel}` : `Next · ${next?.startLabel}`}
      </p>
      <p className="mt-0.5 text-[17px] font-semibold break-words">{(current ?? next)?.title}</p>
      {current && next && (
        <p className="mt-1.5 text-[13.5px]">
          Next: {next.title} at {next.startLabel}
        </p>
      )}
    </section>
  );
}
