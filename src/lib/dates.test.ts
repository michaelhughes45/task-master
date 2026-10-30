import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  addWeeks,
  dayEndInstant,
  dayStartInstant,
  formatDayLong,
  formatDayShort,
  formatMinutes,
  formatTime,
  formatWeekRange,
  fromDbDate,
  instantToWallTime,
  isBefore,
  isDateStr,
  isDoneLate,
  isPastDay,
  isWallTime,
  parseDateParam,
  resolveTimezone,
  todayIn,
  toDbDate,
  wallTimeToInstant,
  weekDays,
  weekRange,
  weekStartOf,
} from "./dates";

const NY = "America/New_York";
const LA = "America/Los_Angeles";
const AKL = "Pacific/Auckland";
const HOUR = 60 * 60 * 1000;

function hoursBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / HOUR;
}

describe("resolveTimezone", () => {
  it("returns the user's zone", () => {
    expect(resolveTimezone({ timezone: NY })).toBe(NY);
  });

  it.each([null, undefined, { timezone: null }, { timezone: "" }, { timezone: "Mars/Base" }])(
    "falls back to UTC for %j",
    (user) => {
      expect(resolveTimezone(user)).toBe("UTC");
    },
  );
});

describe("todayIn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is ahead of UTC late at night in Auckland", () => {
    // 11:30 UTC on Oct 30 is 00:30 on Oct 31 in Auckland (NZDT, +13).
    vi.setSystemTime(new Date("2026-10-30T11:30:00Z"));
    expect(todayIn("UTC")).toBe("2026-10-30");
    expect(todayIn(AKL)).toBe("2026-10-31");
  });

  it("is behind UTC late at night in Los Angeles", () => {
    // 06:30 UTC on Oct 31 is 23:30 on Oct 30 in Los Angeles (PDT, -7).
    vi.setSystemTime(new Date("2026-10-31T06:30:00Z"));
    expect(todayIn("UTC")).toBe("2026-10-31");
    expect(todayIn(LA)).toBe("2026-10-30");
  });

  it("accepts an explicit now", () => {
    expect(todayIn(NY, new Date("2026-03-08T04:59:00Z"))).toBe("2026-03-07");
    expect(todayIn(NY, new Date("2026-03-08T05:00:00Z"))).toBe("2026-03-08");
  });
});

describe("isPastDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 23:30 Oct 30 in Los Angeles, already Oct 31 in UTC.
    vi.setSystemTime(new Date("2026-10-31T06:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the user's today, not UTC's", () => {
    expect(isPastDay("2026-10-30", LA)).toBe(false);
    expect(isPastDay("2026-10-30", "UTC")).toBe(true);
    expect(isPastDay("2026-10-29", LA)).toBe(true);
    expect(isPastDay("2026-10-31", LA)).toBe(false);
  });
});

describe("isBefore", () => {
  it("compares calendar days", () => {
    expect(isBefore("2026-12-31", "2027-01-01")).toBe(true);
    expect(isBefore("2026-10-09", "2026-10-10")).toBe(true);
    expect(isBefore("2026-10-10", "2026-10-10")).toBe(false);
    expect(isBefore("2026-11-01", "2026-10-31")).toBe(false);
  });
});

describe("addDays / addWeeks", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addWeeks("2026-12-28", 1)).toBe("2027-01-04");
    expect(addWeeks("2026-01-05", -1)).toBe("2025-12-29");
  });

  it("is not shifted by daylight saving changes", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
    // Auckland (the test process zone) springs forward on Sep 27, 2026.
    expect(addDays("2026-09-26", 1)).toBe("2026-09-27");
    expect(addDays("2026-09-27", 1)).toBe("2026-09-28");
  });

  it("handles the leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addWeeks("2028-02-26", 1)).toBe("2028-03-04");
  });
});

describe("weekStartOf", () => {
  it("returns the same day for a Monday", () => {
    expect(weekStartOf("2026-10-26")).toBe("2026-10-26");
  });

  it("returns the previous Monday for a Sunday", () => {
    expect(weekStartOf("2026-11-01")).toBe("2026-10-26");
  });

  it("crosses a month boundary", () => {
    expect(weekStartOf("2026-10-01")).toBe("2026-09-28");
  });

  it("crosses a year boundary", () => {
    expect(weekStartOf("2027-01-03")).toBe("2026-12-28");
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
  });

  it("handles the leap day", () => {
    expect(weekStartOf("2028-02-29")).toBe("2028-02-28");
    expect(weekStartOf("2028-03-05")).toBe("2028-02-28");
  });
});

describe("weekDays", () => {
  it("lists Monday to Sunday across a year boundary", () => {
    expect(weekDays("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("includes the leap day", () => {
    expect(weekDays("2028-02-28")).toContain("2028-02-29");
    expect(weekDays("2028-02-28")[6]).toBe("2028-03-05");
  });
});

describe("dayStartInstant / dayEndInstant", () => {
  it("is 24 hours on a normal day", () => {
    const start = dayStartInstant("2026-10-28", NY);
    expect(start.toISOString()).toBe("2026-10-28T04:00:00.000Z");
    expect(hoursBetween(start, dayEndInstant("2026-10-28", NY))).toBe(24);
  });

  it("is 23 hours on the spring forward day", () => {
    const start = dayStartInstant("2026-03-08", NY);
    const end = dayEndInstant("2026-03-08", NY);
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(hoursBetween(start, end)).toBe(23);
  });

  it("is 25 hours on the fall back day", () => {
    const start = dayStartInstant("2026-11-01", NY);
    const end = dayEndInstant("2026-11-01", NY);
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(hoursBetween(start, end)).toBe(25);
  });

  it("starts the day before in UTC for a zone ahead of UTC", () => {
    expect(dayStartInstant("2026-10-31", AKL).toISOString()).toBe("2026-10-30T11:00:00.000Z");
  });

  it("starts at UTC midnight for UTC", () => {
    expect(dayStartInstant("2028-02-29", "UTC").toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(dayEndInstant("2028-02-29", "UTC").toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });

  it("starts at the first midnight when midnight repeats", () => {
    // Havana falls back from 01:00 CDT to 00:00 CST on Nov 1, 2026.
    const start = dayStartInstant("2026-11-01", "America/Havana");
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(hoursBetween(start, dayEndInstant("2026-11-01", "America/Havana"))).toBe(25);
  });

  it("moves to the first valid time when midnight is skipped", () => {
    // São Paulo sprang forward at midnight on Nov 4, 2018, so the day began at 01:00 (-02).
    expect(dayStartInstant("2018-11-04", "America/Sao_Paulo").toISOString()).toBe(
      "2018-11-04T03:00:00.000Z",
    );
  });
});

describe("weekRange", () => {
  it("covers Monday 00:00 to the next Monday 00:00, including a DST change", () => {
    const { start, end } = weekRange("2026-10-26", NY);
    expect(start.toISOString()).toBe("2026-10-26T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(hoursBetween(start, end)).toBe(7 * 24 + 1);
  });

  it("crosses a year boundary", () => {
    const { start, end } = weekRange("2026-12-28", "UTC");
    expect(start.toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-04T00:00:00.000Z");
  });

  it("snaps a mid-week day to its Monday", () => {
    expect(weekRange("2026-10-29", NY)).toEqual(weekRange("2026-10-26", NY));
  });
});

describe("toDbDate / fromDbDate", () => {
  it("stores the day at 00:00 UTC", () => {
    expect(toDbDate("2026-10-28").toISOString()).toBe("2026-10-28T00:00:00.000Z");
    expect(toDbDate("2028-02-29").toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("reads the UTC date back, whatever the process zone", () => {
    expect(fromDbDate(new Date("2026-10-28T00:00:00Z"))).toBe("2026-10-28");
    expect(fromDbDate(new Date("2026-12-31T00:00:00Z"))).toBe("2026-12-31");
  });

  it("round-trips", () => {
    for (const day of ["2026-01-01", "2026-03-08", "2026-11-01", "2028-02-29"]) {
      expect(fromDbDate(toDbDate(day))).toBe(day);
    }
  });
});

describe("wallTimeToInstant / instantToWallTime", () => {
  it("converts on a normal day", () => {
    const instant = wallTimeToInstant("2026-10-28", "09:00", NY);
    expect(instant.toISOString()).toBe("2026-10-28T13:00:00.000Z");
    expect(instantToWallTime(instant, NY)).toBe("09:00");
  });

  it("keeps wall times on either side of spring forward", () => {
    expect(wallTimeToInstant("2026-03-08", "01:00", NY).toISOString()).toBe(
      "2026-03-08T06:00:00.000Z",
    );
    const nine = wallTimeToInstant("2026-03-08", "09:00", NY);
    expect(nine.toISOString()).toBe("2026-03-08T13:00:00.000Z");
    expect(instantToWallTime(nine, NY)).toBe("09:00");
  });

  it("moves a skipped time forward by the gap", () => {
    const instant = wallTimeToInstant("2026-03-08", "02:30", NY);
    expect(instant.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(instantToWallTime(instant, NY)).toBe("03:30");
  });

  it("keeps wall times on either side of fall back", () => {
    const nine = wallTimeToInstant("2026-11-01", "09:00", NY);
    expect(nine.toISOString()).toBe("2026-11-01T14:00:00.000Z");
    expect(instantToWallTime(nine, NY)).toBe("09:00");
    expect(instantToWallTime(new Date("2026-11-01T05:30:00Z"), NY)).toBe("01:30");
    expect(instantToWallTime(new Date("2026-11-01T06:30:00Z"), NY)).toBe("01:30");
  });

  it("resolves a repeated time to its first occurrence", () => {
    expect(wallTimeToInstant("2026-11-01", "01:30", NY).toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    // Auckland falls back from 03:00 NZDT to 02:00 NZST on Apr 5, 2026.
    expect(wallTimeToInstant("2026-04-05", "02:30", AKL).toISOString()).toBe(
      "2026-04-04T13:30:00.000Z",
    );
  });

  it("converts late at night in a zone ahead of UTC", () => {
    const instant = wallTimeToInstant("2026-10-31", "23:30", AKL);
    expect(instant.toISOString()).toBe("2026-10-31T10:30:00.000Z");
    expect(instantToWallTime(instant, AKL)).toBe("23:30");
  });
});

describe("isDoneLate", () => {
  it("daily: on time when ticked before midnight", () => {
    // 23:59 Oct 28 in New York.
    const completedAt = new Date("2026-10-29T03:59:00Z");
    expect(isDoneLate({ occurrenceDay: "2026-10-28", scope: "DAILY", completedAt, tz: NY })).toBe(
      false,
    );
  });

  it("daily: late when ticked the next morning", () => {
    // 08:00 Oct 29 in New York.
    const completedAt = new Date("2026-10-29T12:00:00Z");
    expect(isDoneLate({ occurrenceDay: "2026-10-28", scope: "DAILY", completedAt, tz: NY })).toBe(
      true,
    );
  });

  it("daily: uses the user's zone, not UTC", () => {
    // 22:00 Oct 28 in Los Angeles, already Oct 29 in UTC.
    const completedAt = new Date("2026-10-29T05:00:00Z");
    expect(isDoneLate({ occurrenceDay: "2026-10-28", scope: "DAILY", completedAt, tz: LA })).toBe(
      false,
    );
    expect(
      isDoneLate({ occurrenceDay: "2026-10-28", scope: "DAILY", completedAt, tz: "UTC" }),
    ).toBe(true);
  });

  it("weekly: on time when ticked on the Sunday", () => {
    // 23:00 Sunday Nov 1 in New York (after fall back, -5).
    const completedAt = new Date("2026-11-02T04:00:00Z");
    expect(isDoneLate({ occurrenceDay: "2026-10-26", scope: "WEEKLY", completedAt, tz: NY })).toBe(
      false,
    );
  });

  it("weekly: late when ticked the Monday after", () => {
    // 09:00 Monday Nov 2 in New York.
    const completedAt = new Date("2026-11-02T14:00:00Z");
    expect(isDoneLate({ occurrenceDay: "2026-10-26", scope: "WEEKLY", completedAt, tz: NY })).toBe(
      true,
    );
  });

  it("weekly: on time earlier in the week across a year boundary", () => {
    const completedAt = new Date("2027-01-02T12:00:00Z");
    expect(
      isDoneLate({ occurrenceDay: "2026-12-28", scope: "WEEKLY", completedAt, tz: "UTC" }),
    ).toBe(false);
  });
});

describe("formatters", () => {
  it("formats days", () => {
    expect(formatDayLong("2026-10-28")).toBe("Wednesday, October 28");
    expect(formatDayShort("2026-10-28")).toBe("Wed, Oct 28");
    expect(formatDayLong("2028-02-29")).toBe("Tuesday, February 29");
  });

  it("formats a week within one month", () => {
    expect(formatWeekRange("2026-10-19")).toBe("Oct 19 – 25");
  });

  it("formats a week across months", () => {
    expect(formatWeekRange("2026-10-26")).toBe("Oct 26 – Nov 1");
  });

  it("formats a week across years", () => {
    expect(formatWeekRange("2026-12-28")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });

  it("formats times in the given zone", () => {
    const instant = new Date("2026-10-28T13:00:00Z");
    expect(formatTime(instant, NY)).toBe("9:00 AM");
    expect(formatTime(instant, "UTC")).toBe("1:00 PM");
    expect(formatTime(new Date("2026-10-28T04:00:00Z"), NY)).toBe("12:00 AM");
  });

  it.each([
    [0, "0 min"],
    [25, "25 min"],
    [59, "59 min"],
    [60, "1h"],
    [61, "1h 1m"],
    [95, "1h 35m"],
    [130, "2h 10m"],
  ])("formatMinutes(%i) is %j", (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});

describe("parseDateParam", () => {
  const fallback = "2026-10-30";

  it("accepts a real day", () => {
    expect(parseDateParam("2026-11-02", fallback)).toBe("2026-11-02");
    expect(parseDateParam("2028-02-29", fallback)).toBe("2028-02-29");
    expect(parseDateParam("1900-01-01", fallback)).toBe("1900-01-01");
    expect(parseDateParam("2999-12-31", fallback)).toBe("2999-12-31");
  });

  it.each([
    undefined,
    "",
    ["2026-11-02"],
    "2026-11-2",
    "2026/11/02",
    "2026-02-30",
    "2027-02-29",
    "2026-13-01",
    "0005-01-01",
    "0050-01-01",
    "1899-12-31",
    "3000-01-01",
    "9999-12-31",
    "2026-11-02T00:00",
    " 2026-11-02",
  ])("falls back for %j", (value) => {
    expect(parseDateParam(value, fallback)).toBe(fallback);
  });
});

describe("isDateStr / isWallTime", () => {
  it("validates days", () => {
    expect(isDateStr("2026-10-28")).toBe(true);
    expect(isDateStr("2026-04-31")).toBe(false);
    expect(isDateStr(20261028)).toBe(false);
  });

  it("validates wall times", () => {
    expect(isWallTime("00:00")).toBe(true);
    expect(isWallTime("23:59")).toBe(true);
    expect(isWallTime("24:00")).toBe(false);
    expect(isWallTime("9:00")).toBe(false);
    expect(isWallTime("09:60")).toBe(false);
  });
});
