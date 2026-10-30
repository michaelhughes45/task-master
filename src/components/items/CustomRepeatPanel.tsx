"use client";

import { useId } from "react";
import { weekStartOf } from "@/lib/dates";
import {
  WEEKDAYS,
  WEEKDAY_NAMES,
  buildRRule,
  customOptions,
  describeRRule,
  nthWeekdayLabel,
  repeatProblem,
  type CustomRepeat,
  type RepeatFreq,
  type WeekdayCode,
} from "@/lib/rrule-builder";
import { cn } from "@/lib/utils";
import type { DateStr, TaskScope } from "@/types/dates";

const UNITS: { value: RepeatFreq; unit: string }[] = [
  { value: "DAILY", unit: "day" },
  { value: "WEEKLY", unit: "week" },
  { value: "MONTHLY", unit: "month" },
  { value: "YEARLY", unit: "year" },
];

const SMALL_INPUT =
  "h-11 min-w-0 rounded-md border border-input bg-card px-2 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-sm dark:scheme-dark";
const RADIO = "size-4 flex-none accent-primary";
const RADIO_ROW = "flex min-h-11 flex-wrap items-center gap-2.5 md:min-h-9";

interface CustomRepeatPanelProps {
  day: DateStr;
  scope: TaskScope;
  value: CustomRepeat;
  onChange: (value: CustomRepeat) => void;
  // From the last submit; replaces the live summary until the fields change.
  error?: string;
}

export function CustomRepeatPanel({ day, scope, value, onChange, error }: CustomRepeatPanelProps) {
  const id = useId();
  const freq = scope === "WEEKLY" ? "WEEKLY" : value.freq;
  const plural = value.interval.trim() !== "1";
  const rule = buildRRule(customOptions(value, day, scope));
  const problem = error ?? repeatProblem(rule, scope, scope === "WEEKLY" ? weekStartOf(day) : day);

  function set<K extends keyof CustomRepeat>(key: K, next: CustomRepeat[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-md border bg-background p-3.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>Repeat every</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          value={value.interval}
          onChange={(e) => set("interval", e.target.value)}
          aria-label="Repeat interval"
          className={cn(SMALL_INPUT, "w-16")}
        />
        {scope === "WEEKLY" ? (
          <span>{plural ? "weeks" : "week"}</span>
        ) : (
          <select
            value={value.freq}
            onChange={(e) => set("freq", e.target.value as RepeatFreq)}
            aria-label="Repeat unit"
            className={SMALL_INPUT}
          >
            {UNITS.map(({ value: unitFreq, unit }) => (
              <option key={unitFreq} value={unitFreq}>
                {plural ? `${unit}s` : unit}
              </option>
            ))}
          </select>
        )}
      </div>

      {freq === "WEEKLY" && scope === "DAILY" && (
        <WeekdayChips value={value.weekdays} onChange={(weekdays) => set("weekdays", weekdays)} />
      )}

      {freq === "MONTHLY" && (
        <fieldset className="flex flex-col">
          <legend className="sr-only">Repeat on</legend>
          <label className={RADIO_ROW}>
            <input
              type="radio"
              name={`${id}-monthly`}
              checked={value.monthlyBy === "day"}
              onChange={() => set("monthlyBy", "day")}
              className={RADIO}
            />
            On day {Number(day.slice(8))}
          </label>
          <label className={RADIO_ROW}>
            <input
              type="radio"
              name={`${id}-monthly`}
              checked={value.monthlyBy === "weekday"}
              onChange={() => set("monthlyBy", "weekday")}
              className={RADIO}
            />
            On the {nthWeekdayLabel(day)}
          </label>
        </fieldset>
      )}

      <fieldset className="flex flex-col">
        <legend className="mb-1 font-medium">Ends</legend>
        <label className={RADIO_ROW}>
          <input
            type="radio"
            name={`${id}-ends`}
            checked={value.ends === "never"}
            onChange={() => set("ends", "never")}
            className={RADIO}
          />
          Never
        </label>
        <label className={RADIO_ROW}>
          <input
            type="radio"
            name={`${id}-ends`}
            checked={value.ends === "until"}
            onChange={() => set("ends", "until")}
            className={RADIO}
          />
          On
          <input
            type="date"
            value={value.until}
            onChange={(e) => onChange({ ...value, ends: "until", until: e.target.value })}
            aria-label="End date"
            className={SMALL_INPUT}
          />
        </label>
        <label className={RADIO_ROW}>
          <input
            type="radio"
            name={`${id}-ends`}
            checked={value.ends === "count"}
            onChange={() => set("ends", "count")}
            className={RADIO}
          />
          After
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={value.count}
            onChange={(e) => onChange({ ...value, ends: "count", count: e.target.value })}
            aria-label="Number of times"
            className={cn(SMALL_INPUT, "w-16")}
          />
          times
        </label>
      </fieldset>

      <p aria-live="polite" className={cn("text-[13px]", problem ? "text-destructive" : "text-muted-foreground")}>
        {problem ?? describeRRule(rule, day)}
      </p>
    </div>
  );
}

// At least one day stays chosen: the last one can't be turned off.
function WeekdayChips({ value, onChange }: { value: WeekdayCode[]; onChange: (days: WeekdayCode[]) => void }) {
  function toggle(day: WeekdayCode) {
    if (!value.includes(day)) onChange([...value, day]);
    else if (value.length > 1) onChange(value.filter((d) => d !== day));
  }

  return (
    // Seven equal columns on phones: 44px chips don't fit across 375px, so they share the width.
    <div role="group" aria-label="Repeat on" className="grid grid-cols-7 gap-1 md:flex md:items-center md:gap-1.5">
      <span aria-hidden="true" className="mr-1 hidden md:inline">
        On
      </span>
      {WEEKDAYS.map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={WEEKDAY_NAMES[day]}
            onClick={() => toggle(day)}
            className={cn(
              "flex aspect-square w-full max-w-11 items-center justify-center justify-self-center rounded-full text-[13px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9",
              on ? "bg-primary text-primary-foreground" : "border text-foreground hover:bg-muted",
            )}
          >
            {WEEKDAY_NAMES[day][0]}
          </button>
        );
      })}
    </div>
  );
}
