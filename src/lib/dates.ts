import { tz as inZone, tzOffset } from "@date-fns/tz";
import { format } from "date-fns";
import { isValidTimezone } from "@/lib/timezones";
import type { DateStr, TaskScope, WallTime } from "@/types/dates";

// Calendar math on a DateStr uses Date.UTC, so neither the process timezone nor daylight
// saving can shift the day. Instants are only computed against an explicit zone.

const DATE_STR = /^\d{4}-\d{2}-\d{2}$/;
// Accepted years. Keeps Date.UTC away from years 0–99 (read as 19xx) and from day math
// that would run past 9999, where toISOString stops returning YYYY-MM-DD.
const MIN_DAY = "1900-01-01";
const MAX_DAY = "2999-12-31";
const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function parts(day: DateStr) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month: month - 1, date };
}

// The day at 00:00 UTC. Date.UTC normalizes overflow, so `date + n` moves by calendar days.
function utcDate(day: DateStr, addDays = 0) {
  const { year, month, date } = parts(day);
  return new Date(Date.UTC(year, month, date + addDays));
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDay(day: DateStr, pattern: string) {
  return format(utcDate(day), pattern, { in: inZone("UTC") });
}

export function isDateStr(value: unknown): value is DateStr {
  if (typeof value !== "string" || !DATE_STR.test(value)) return false;
  if (value < MIN_DAY || value > MAX_DAY) return false;
  // Round-trip rejects days that don't exist, like 2026-02-30.
  return toDateStr(utcDate(value)) === value;
}

export function resolveTimezone(user: { timezone?: string | null } | null | undefined) {
  const timezone = user?.timezone;
  return timezone && isValidTimezone(timezone) ? timezone : "UTC";
}

export function todayIn(tz: string, now: Date = new Date()): DateStr {
  return format(now, "yyyy-MM-dd", { in: inZone(tz) });
}

export function addDays(day: DateStr, n: number): DateStr {
  return toDateStr(utcDate(day, n));
}

export function addWeeks(day: DateStr, n: number): DateStr {
  return addDays(day, n * 7);
}

// Weeks run Monday–Sunday and are identified by their Monday.
export function weekStartOf(day: DateStr): DateStr {
  const daysSinceMonday = (utcDate(day).getUTCDay() + 6) % 7;
  return addDays(day, -daysSinceMonday);
}

export function weekDays(weekStart: DateStr): DateStr[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// DateStrs sort lexicographically in calendar order.
export function isBefore(dayA: DateStr, dayB: DateStr) {
  return dayA < dayB;
}

export function isPastDay(day: DateStr, tz: string, now: Date = new Date()) {
  return isBefore(day, todayIn(tz, now));
}

export function dayStartInstant(day: DateStr, tz: string): Date {
  return wallTimeToInstant(day, "00:00", tz);
}

// Exclusive: the start of the next day. 23 or 25 hours after the start on DST change days.
export function dayEndInstant(day: DateStr, tz: string): Date {
  return dayStartInstant(addDays(day, 1), tz);
}

// [start, end) of the Monday–Sunday week containing `weekStart`, for range queries.
export function weekRange(weekStart: DateStr, tz: string) {
  const monday = weekStartOf(weekStart);
  return { start: dayStartInstant(monday, tz), end: dayStartInstant(addWeeks(monday, 1), tz) };
}

// Prisma reads and writes @db.Date as a Date at 00:00 UTC.
export function toDbDate(day: DateStr): Date {
  return utcDate(day);
}

export function fromDbDate(date: Date): DateStr {
  return toDateStr(date);
}

export function isWallTime(value: unknown): value is WallTime {
  return typeof value === "string" && WALL_TIME.test(value);
}

// Resolved like RFC 5545 (and Google Calendar): a repeated time (fall back) is its first
// occurrence; a skipped time (spring forward) uses the offset before the gap, so it moves
// forward by the gap. Built on tzOffset (Intl) rather than the TZDate constructor, whose
// choice for repeated times depends on the process timezone.
export function wallTimeToInstant(day: DateStr, time: WallTime, tz: string): Date {
  const { year, month, date } = parts(day);
  const [hours, minutes] = time.split(":").map(Number);
  const asUtc = Date.UTC(year, month, date, hours, minutes);
  // Offsets a day either side; no zone changes offset twice within 48 hours.
  const offsets = [tzOffset(tz, new Date(asUtc - DAY_MS)), tzOffset(tz, new Date(asUtc + DAY_MS))];
  // A candidate is real when the zone actually has that offset at that instant.
  const valid = offsets
    .map((offset) => ({ offset, instant: asUtc - offset * MINUTE_MS }))
    .filter(({ offset, instant }) => tzOffset(tz, new Date(instant)) === offset)
    .map(({ instant }) => instant);
  return new Date(valid.length > 0 ? Math.min(...valid) : asUtc - offsets[0] * MINUTE_MS);
}

export function instantToWallTime(instant: Date, tz: string): WallTime {
  return format(instant, "HH:mm", { in: inZone(tz) });
}

interface DoneLateInput {
  occurrenceDay: DateStr;
  scope: TaskScope;
  completedAt: Date;
  tz: string;
}

// Late = ticked after the occurrence's day (daily) or week (weekly) ended in the user's zone.
export function isDoneLate({ occurrenceDay, scope, completedAt, tz }: DoneLateInput) {
  const lastDay = scope === "DAILY" ? occurrenceDay : addDays(weekStartOf(occurrenceDay), 6);
  return isBefore(lastDay, todayIn(tz, completedAt));
}

// "Wednesday, October 28"
export function formatDayLong(day: DateStr) {
  return formatDay(day, "EEEE, MMMM d");
}

// "Wed, Oct 28"
export function formatDayShort(day: DateStr) {
  return formatDay(day, "EEE, MMM d");
}

// "Oct 19 – 25", "Oct 26 – Nov 1", "Dec 28, 2026 – Jan 3, 2027"
export function formatWeekRange(weekStart: DateStr) {
  const monday = weekStartOf(weekStart);
  const sunday = addDays(monday, 6);
  if (monday.slice(0, 4) !== sunday.slice(0, 4)) {
    return `${formatDay(monday, "MMM d, yyyy")} – ${formatDay(sunday, "MMM d, yyyy")}`;
  }
  if (monday.slice(0, 7) !== sunday.slice(0, 7)) {
    return `${formatDay(monday, "MMM d")} – ${formatDay(sunday, "MMM d")}`;
  }
  return `${formatDay(monday, "MMM d")} – ${formatDay(sunday, "d")}`;
}

// "9:00 AM" in the given zone.
export function formatTime(instant: Date, tz: string) {
  return format(instant, "h:mm a", { in: inZone(tz) });
}

// "25 min", "1h", "2h 10m"
export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

// For ?date= search params: a real YYYY-MM-DD day, otherwise the fallback.
export function parseDateParam(value: string | string[] | undefined, fallback: DateStr): DateStr {
  return isDateStr(value) ? value : fallback;
}
