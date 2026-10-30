import { RRule } from "rrule";
import { addMonths, formatDayWithYear, formatMonthDay, isDateStr, toDbDate } from "@/lib/dates";
import type { DateStr, TaskScope } from "@/types/dates";

// The repeat options the dialog offers, as RRULE parts ("FREQ=WEEKLY;BYDAY=MO,WE"). Only rules
// this file can build are accepted, which keeps every stored rule one that the recurrence
// engine expands quickly (no BYMONTH, BYSETPOS or sub-daily rules). Pure: no clock, no zone.

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof WEEKDAYS)[number];
export const WEEKDAY_NAMES: Record<WeekdayCode, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type RepeatFreq = (typeof FREQS)[number];

export const MAX_INTERVAL = 99;
export const MAX_COUNT = 999;

// MONTHLY only. `nth` is 1–4, or -1 for the last one in the month.
export type MonthlyRepeat = { by: "day"; day: number } | { by: "weekday"; nth: number; weekday: WeekdayCode };
export type RepeatEnd = { type: "never" } | { type: "until"; until: DateStr } | { type: "count"; count: number };

export interface RepeatOptions {
  freq: RepeatFreq;
  interval: number;
  // WEEKLY only, Monday first. Empty repeats on the start's own weekday (weekly-list tasks).
  weekdays: WeekdayCode[];
  // MONTHLY only. Null repeats on the start's day of the month.
  monthly: MonthlyRepeat | null;
  end: RepeatEnd;
}

const KEYS = new Set(["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "UNTIL", "COUNT"]);
const WORKWEEK = "MO,TU,WE,TH,FR";

function sortWeekdays(days: WeekdayCode[]) {
  return WEEKDAYS.filter((day) => days.includes(day));
}

export function buildRRule(options: RepeatOptions): string {
  const parts = [`FREQ=${options.freq}`];
  if (options.interval !== 1) parts.push(`INTERVAL=${options.interval}`);
  if (options.freq === "WEEKLY" && options.weekdays.length > 0) {
    parts.push(`BYDAY=${sortWeekdays(options.weekdays).join(",")}`);
  }
  if (options.freq === "MONTHLY" && options.monthly) {
    const { monthly } = options;
    parts.push(monthly.by === "day" ? `BYMONTHDAY=${monthly.day}` : `BYDAY=${monthly.nth}${monthly.weekday}`);
  }
  if (options.end.type === "until") parts.push(`UNTIL=${options.end.until.replaceAll("-", "")}`);
  if (options.end.type === "count") parts.push(`COUNT=${options.end.count}`);
  return parts.join(";");
}

function readInt(value: string | undefined) {
  return value !== undefined && /^\d{1,4}$/.test(value) ? Number(value) : null;
}

function isWeekday(value: string): value is WeekdayCode {
  return (WEEKDAYS as readonly string[]).includes(value);
}

function readMonthly(byDay: string | undefined, byMonthDay: string | undefined): MonthlyRepeat | null | undefined {
  if (byDay !== undefined && byMonthDay !== undefined) return undefined;
  if (byMonthDay !== undefined) {
    const day = readInt(byMonthDay);
    return day !== null && day >= 1 && day <= 31 ? { by: "day", day } : undefined;
  }
  if (byDay !== undefined) {
    const match = /^(-1|[1-4])([A-Z]{2})$/.exec(byDay);
    if (!match || !isWeekday(match[2])) return undefined;
    return { by: "weekday", nth: Number(match[1]), weekday: match[2] };
  }
  return null;
}

function readWeekdays(byDay: string | undefined): WeekdayCode[] | undefined {
  if (byDay === undefined) return [];
  const days = byDay.split(",");
  if (!days.every(isWeekday) || new Set(days).size !== days.length) return undefined;
  return sortWeekdays(days);
}

function readEnd(until: string | undefined, count: string | undefined): RepeatEnd | undefined {
  if (until !== undefined && count !== undefined) return undefined;
  if (count !== undefined) {
    const n = readInt(count);
    return n === null ? undefined : { type: "count", count: n };
  }
  if (until !== undefined) {
    const match = /^(\d{4})(\d{2})(\d{2})$/.exec(until);
    if (!match) return undefined;
    const day = `${match[1]}-${match[2]}-${match[3]}`;
    return isDateStr(day) ? { type: "until", until: day } : undefined;
  }
  return { type: "never" };
}

// The options of a rule buildRRule could have written, or null for anything else. Numbers are
// read but not range-checked; repeatProblem does that.
export function parseRRule(rule: string): RepeatOptions | null {
  const fields = new Map<string, string>();
  for (const part of rule.toUpperCase().split(";")) {
    const match = /^([A-Z]+)=(.+)$/.exec(part);
    if (!match || !KEYS.has(match[1]) || fields.has(match[1])) return null;
    fields.set(match[1], match[2]);
  }

  const freq = FREQS.find((f) => f === fields.get("FREQ"));
  const interval = fields.has("INTERVAL") ? readInt(fields.get("INTERVAL")) : 1;
  const end = readEnd(fields.get("UNTIL"), fields.get("COUNT"));
  if (!freq || interval === null || !end) return null;

  const byDay = fields.get("BYDAY");
  const byMonthDay = fields.get("BYMONTHDAY");
  if (freq === "WEEKLY") {
    const weekdays = readWeekdays(byDay);
    if (!weekdays || byMonthDay !== undefined) return null;
    return { freq, interval, weekdays, monthly: null, end };
  }
  if (freq === "MONTHLY") {
    const monthly = readMonthly(byDay, byMonthDay);
    if (monthly === undefined) return null;
    return { freq, interval, weekdays: [], monthly, end };
  }
  if (byDay !== undefined || byMonthDay !== undefined) return null;
  return { freq, interval, weekdays: [], monthly: null, end };
}

// The rule as buildRRule writes it (days in order, upper case), or null if it isn't one.
export function normalizeRRule(rule: string): string | null {
  const options = parseRRule(rule);
  return options && buildRRule(options);
}

// ---------------------------------------------------------------------------------------------
// Day facts, from the DateStr alone.

function dayParts(day: DateStr) {
  const date = toDbDate(day);
  const weekday = WEEKDAYS[(date.getUTCDay() + 6) % 7];
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return { weekday, dayOfMonth: date.getUTCDate(), daysInMonth };
}

export function weekdayOf(day: DateStr): WeekdayCode {
  return dayParts(day).weekday;
}

// The day's weekday within its month: 1–4, or -1 when it's the last one (so the 29th–31st,
// and the 22nd–28th when no later one fits).
export function nthWeekdayOf(day: DateStr): { nth: number; weekday: WeekdayCode } {
  const { weekday, dayOfMonth, daysInMonth } = dayParts(day);
  const nth = dayOfMonth + 7 > daysInMonth ? -1 : Math.ceil(dayOfMonth / 7);
  return { nth, weekday };
}

const ORDINAL_WORDS: Record<number, string> = { 1: "first", 2: "second", 3: "third", 4: "fourth", [-1]: "last" };
const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "last" };

// "last Wednesday", "second Tuesday"
export function nthWeekdayLabel(day: DateStr) {
  const { nth, weekday } = nthWeekdayOf(day);
  return `${ORDINAL_WORDS[nth]} ${WEEKDAY_NAMES[weekday]}`;
}

// ---------------------------------------------------------------------------------------------
// Labels

function dayList(days: WeekdayCode[]) {
  if (days.length === 1) return WEEKDAY_NAMES[days[0]];
  return days.map((day) => WEEKDAY_NAMES[day].slice(0, 3)).join(", ");
}

function every(interval: number, unit: string) {
  return `Every ${interval} ${unit}s`;
}

function describeBase(options: RepeatOptions, startDay: DateStr) {
  const { freq, interval: n } = options;
  if (freq === "DAILY") return n === 1 ? "Repeats daily" : every(n, "day");
  if (freq === "WEEKLY") {
    const days = options.weekdays;
    if (n === 1 && days.join(",") === WORKWEEK) return "Every weekday";
    if (days.length === 0) return n === 1 ? "Repeats weekly" : every(n, "week");
    return n === 1 ? `Weekly on ${dayList(days)}` : `${every(n, "week")} on ${dayList(days)}`;
  }
  if (freq === "MONTHLY") {
    const monthly = options.monthly ?? { by: "day", day: dayParts(startDay).dayOfMonth };
    const on =
      monthly.by === "day" ? `day ${monthly.day}` : `the ${ORDINALS[monthly.nth]} ${WEEKDAY_NAMES[monthly.weekday]}`;
    return n === 1 ? `Monthly on ${on}` : `${every(n, "month")} on ${on}`;
  }
  const on = formatMonthDay(startDay);
  return n === 1 ? `Annually on ${on}` : `${every(n, "year")} on ${on}`;
}

// "Weekly on Mon, Wed, Fri", "Every 2 weeks on Monday, until Dec 31, 2026". `startDay` is the
// series' first day (or any occurrence's), for rules that repeat on its date. Null for a rule
// that isn't one of ours.
export function describeRRule(rule: string, startDay: DateStr): string | null {
  const options = parseRRule(rule);
  if (!options) return null;
  const { end } = options;
  const suffix =
    end.type === "until"
      ? `, until ${formatDayWithYear(end.until)}`
      : end.type === "count"
        ? `, ${end.count} ${end.count === 1 ? "time" : "times"}`
        : "";
  return describeBase(options, startDay) + suffix;
}

// ---------------------------------------------------------------------------------------------
// Presets for the Repeat select

export type RepeatPreset = "none" | "daily" | "weekly" | "weekdays" | "monthly" | "yearly" | "biweekly" | "custom";

export interface RepeatChoice {
  value: RepeatPreset;
  label: string;
  // Null for "Does not repeat" and "Custom…".
  rrule: string | null;
}

const NONE: RepeatChoice = { value: "none", label: "Does not repeat", rrule: null };
const CUSTOM: RepeatChoice = { value: "custom", label: "Custom…", rrule: null };

// Daily tasks and events offer Google Calendar's list for the day; weekly-list tasks repeat by
// week only.
export function presetsFor(day: DateStr, scope: TaskScope): RepeatChoice[] {
  if (scope === "WEEKLY") {
    return [
      NONE,
      { value: "weekly", label: "Every week", rrule: "FREQ=WEEKLY" },
      { value: "biweekly", label: "Every 2 weeks", rrule: "FREQ=WEEKLY;INTERVAL=2" },
      CUSTOM,
    ];
  }
  const weekday = weekdayOf(day);
  const { nth } = nthWeekdayOf(day);
  const name = WEEKDAY_NAMES[weekday];
  const nthLabel = nthWeekdayLabel(day);
  return [
    NONE,
    { value: "daily", label: "Daily", rrule: "FREQ=DAILY" },
    { value: "weekly", label: `Weekly on ${name}`, rrule: `FREQ=WEEKLY;BYDAY=${weekday}` },
    { value: "weekdays", label: "Every weekday (Monday to Friday)", rrule: `FREQ=WEEKLY;BYDAY=${WORKWEEK}` },
    { value: "monthly", label: `Monthly on the ${nthLabel}`, rrule: `FREQ=MONTHLY;BYDAY=${nth}${weekday}` },
    { value: "yearly", label: `Annually on ${formatMonthDay(day)}`, rrule: "FREQ=YEARLY" },
    CUSTOM,
  ];
}

// ---------------------------------------------------------------------------------------------
// Form state: a preset, or the Custom panel's fields (numbers kept as typed).

export interface CustomRepeat {
  freq: RepeatFreq;
  interval: string;
  weekdays: WeekdayCode[];
  monthlyBy: "day" | "weekday";
  ends: RepeatEnd["type"];
  until: DateStr;
  count: string;
}

export interface RepeatState {
  preset: RepeatPreset;
  custom: CustomRepeat;
}

function defaultCustom(day: DateStr): CustomRepeat {
  return {
    freq: "WEEKLY",
    interval: "1",
    weekdays: [weekdayOf(day)],
    monthlyBy: "day",
    ends: "never",
    until: addMonths(day, 3),
    count: "10",
  };
}

// The Custom panel's fields for a rule, so switching to Custom… starts from the current choice.
export function customFromRule(rule: string | null, day: DateStr): CustomRepeat {
  const base = defaultCustom(day);
  const options = rule ? parseRRule(rule) : null;
  if (!options) return base;
  return {
    freq: options.freq,
    interval: String(options.interval),
    weekdays: options.weekdays.length > 0 ? options.weekdays : base.weekdays,
    monthlyBy: options.monthly?.by ?? "day",
    ends: options.end.type,
    until: options.end.type === "until" ? options.end.until : base.until,
    count: options.end.type === "count" ? String(options.end.count) : base.count,
  };
}

// The form's starting state for a stored rule: its preset when it is one, else Custom….
export function repeatStateFor(rule: string | null, day: DateStr, scope: TaskScope): RepeatState {
  const custom = customFromRule(rule, day);
  const normalized = rule && normalizeRRule(rule);
  if (!normalized) return { preset: "none", custom };
  const preset = presetsFor(day, scope).find((choice) => choice.rrule === normalized);
  return { preset: preset?.value ?? "custom", custom };
}

// A field left empty or not a whole number becomes 0, which repeatProblem reports.
function wholeNumber(value: string) {
  return /^\d{1,4}$/.test(value.trim()) ? Number(value) : 0;
}

export function customOptions(custom: CustomRepeat, day: DateStr, scope: TaskScope): RepeatOptions {
  const freq = scope === "WEEKLY" ? "WEEKLY" : custom.freq;
  const monthly: MonthlyRepeat =
    custom.monthlyBy === "day" ? { by: "day", day: dayParts(day).dayOfMonth } : { by: "weekday", ...nthWeekdayOf(day) };
  const end: RepeatEnd =
    custom.ends === "until"
      ? { type: "until", until: custom.until }
      : custom.ends === "count"
        ? { type: "count", count: wholeNumber(custom.count) }
        : { type: "never" };
  return {
    freq,
    interval: wholeNumber(custom.interval),
    weekdays: freq === "WEEKLY" && scope === "DAILY" ? sortWeekdays(custom.weekdays) : [],
    monthly: freq === "MONTHLY" ? monthly : null,
    end,
  };
}

// The rule the form saves, or null for "Does not repeat".
export function repeatRule(state: RepeatState, day: DateStr, scope: TaskScope): string | null {
  if (state.preset === "custom") return buildRRule(customOptions(state.custom, day, scope));
  return presetsFor(day, scope).find((choice) => choice.value === state.preset)?.rrule ?? null;
}

// ---------------------------------------------------------------------------------------------
// Validation, shared by the forms and the actions

// Why a rule can't be saved for a series starting on `startDay` (a weekly task's Monday), or
// null when it's fine. Every rule that passes has at least one occurrence.
export function repeatProblem(rule: string, scope: TaskScope, startDay: DateStr): string | null {
  const options = parseRRule(rule);
  if (!options) return "Choose a repeat option from the list";
  if (scope === "WEEKLY" && (options.freq !== "WEEKLY" || options.weekdays.length > 0)) {
    return "Weekly tasks repeat by week";
  }
  if (options.interval < 1 || options.interval > MAX_INTERVAL) {
    return `Repeat every 1 to ${MAX_INTERVAL}`;
  }
  const { end } = options;
  if (end.type === "count" && (end.count < 1 || end.count > MAX_COUNT)) {
    return `End after 1 to ${MAX_COUNT} times`;
  }
  if (end.type === "until" && end.until < startDay) return "The end date can't be before the start date";
  return hasOccurrence(options, startDay) ? null : "That doesn't repeat on any day before the end date";
}

// Only an end date can leave a rule with no occurrence (weekly on Monday, starting on a
// Tuesday, until that Saturday). Without one, every rule buildRRule writes matches within a
// few months, so rrule finds the first occurrence fast.
function hasOccurrence(options: RepeatOptions, startDay: DateStr) {
  if (options.end.type !== "until") return true;
  const start = toDbDate(startDay);
  const rule = new RRule({ ...RRule.parseString(buildRRule(options)), dtstart: start });
  return rule.after(start, true) !== null;
}
