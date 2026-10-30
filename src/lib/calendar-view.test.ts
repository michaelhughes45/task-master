import { describe, expect, it } from "vitest";
import { buildCalendarColumns, buildMonthDays, calendarDays, calendarHref, parseView, rangeLabel, stepDate } from "@/lib/calendar-view";
import type { EventView } from "@/types/events";

const NY = "America/New_York";

function timed(id: string, startAt: string, endAt: string): EventView {
  return {
    id,
    key: id,
    occurrenceStart: new Date(startAt),
    title: id,
    notes: null,
    location: null,
    color: "BLUE",
    allDay: false,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
  };
}

function allDay(id: string, first: string, dayAfterLast: string): EventView {
  return { ...timed(id, `${first}T00:00:00Z`, `${dayAfterLast}T00:00:00Z`), allDay: true, color: "GREEN" };
}

describe("parseView", () => {
  it("accepts day, week and month", () => {
    expect(parseView("day")).toBe("day");
    expect(parseView("week")).toBe("week");
    expect(parseView("month")).toBe("month");
  });

  it("falls back to week for bad values and missing ones", () => {
    expect(parseView("year")).toBe("week");
    expect(parseView(["day", "week"])).toBe("week");
    expect(parseView(undefined)).toBe("week");
  });
});

describe("calendarHref", () => {
  it("leaves the date out for today", () => {
    expect(calendarHref("day")).toBe("/calendar?view=day");
    expect(calendarHref("week", "2026-11-04")).toBe("/calendar?view=week&date=2026-11-04");
  });
});

describe("calendarDays", () => {
  it("is Monday to Sunday in the week view", () => {
    expect(calendarDays("week", "2026-10-28")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("is the one day in the day view", () => {
    expect(calendarDays("day", "2026-11-01")).toEqual(["2026-11-01"]);
  });

  it("is the whole Monday-to-Sunday grid in the month view", () => {
    const days = calendarDays("month", "2026-10-28");
    expect(days).toHaveLength(35);
    expect(days[0]).toBe("2026-09-28");
    expect(days[34]).toBe("2026-11-01");
    expect(calendarDays("month", "2026-08-01")).toHaveLength(42);
    expect(calendarDays("month", "2027-02-01")).toHaveLength(28);
  });
});

describe("stepDate", () => {
  it("moves by a day or a week", () => {
    expect(stepDate("day", "2026-10-31", 1)).toBe("2026-11-01");
    expect(stepDate("day", "2026-03-01", -1)).toBe("2026-02-28");
    expect(stepDate("week", "2026-10-28", 1)).toBe("2026-11-04");
    expect(stepDate("week", "2026-01-02", -1)).toBe("2025-12-26");
  });

  it("moves by a month, clamping the day", () => {
    expect(stepDate("month", "2026-10-28", 1)).toBe("2026-11-28");
    expect(stepDate("month", "2026-12-31", 1)).toBe("2027-01-31");
    expect(stepDate("month", "2027-01-31", 1)).toBe("2027-02-28");
    expect(stepDate("month", "2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("rangeLabel", () => {
  it("names the day", () => {
    expect(rangeLabel("day", "2026-10-28")).toBe("Wednesday, October 28");
  });

  it("adds the year to a week", () => {
    expect(rangeLabel("week", "2026-10-28")).toBe("Oct 26 – Nov 1, 2026");
    expect(rangeLabel("week", "2026-10-14")).toBe("Oct 12 – 18, 2026");
  });

  it("names the month", () => {
    expect(rangeLabel("month", "2026-10-28")).toBe("October 2026");
    expect(rangeLabel("month", "2027-01-01")).toBe("January 2027");
  });

  it("keeps both years on a week across New Year", () => {
    expect(rangeLabel("week", "2026-12-31")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
});

describe("buildCalendarColumns", () => {
  const build = (events: EventView[], days: string[], view: "day" | "week" = "day") =>
    buildCalendarColumns({ events, days, today: "2026-10-28", view, tz: NY });

  it("positions by New York wall time and labels the time", () => {
    // 13:00 UTC is 9:00 AM EDT.
    const { columns } = build([timed("gym", "2026-10-28T13:00:00Z", "2026-10-28T14:00:00Z")], ["2026-10-28"]);
    expect(columns[0]).toMatchObject({ heading: "Wednesday", dayNumber: 28, isToday: true });
    expect(columns[0].timed[0]).toMatchObject({
      id: "gym",
      timeLabel: "9:00 AM – 10:00 AM",
      showTime: true,
      layout: { top: 432, height: 48 },
    });
  });

  it("keeps a 9 AM event at 9 AM on the day DST ends", () => {
    // Nov 1, 2026: New York falls back at 2 AM, so 9 AM EST is 14:00 UTC.
    const { columns } = build([timed("a", "2026-11-01T14:00:00Z", "2026-11-01T15:00:00Z")], ["2026-11-01"]);
    expect(columns[0].timed[0].layout).toMatchObject({ top: 432, height: 48 });
  });

  it("keeps a 9 AM event at 9 AM on the day DST starts", () => {
    // Mar 8, 2026: New York springs forward, so 9 AM EDT is 13:00 UTC.
    const { columns } = build([timed("a", "2026-03-08T13:00:00Z", "2026-03-08T14:00:00Z")], ["2026-03-08"]);
    expect(columns[0].timed[0].layout.top).toBe(432);
  });

  it("clips an event crossing midnight to each day", () => {
    // 10 PM Oct 27 to 1 AM Oct 28 in New York.
    const event = timed("late", "2026-10-28T02:00:00Z", "2026-10-28T05:00:00Z");
    const { columns } = build([event], ["2026-10-27", "2026-10-28"], "week");
    expect(columns[0].timed[0].layout).toMatchObject({ top: 22 * 48, height: 2 * 48 });
    expect(columns[1].timed[0].layout).toMatchObject({ top: 0, height: 48 });
    expect(columns[1].timed[0].timeLabel).toBe("10:00 PM – 1:00 AM");
  });

  it("keeps each occurrence of a repeating event apart", () => {
    // The same series at 9 AM EDT on Monday and Wednesday.
    const monday = { ...timed("gym", "2026-10-26T13:00:00Z", "2026-10-26T14:00:00Z"), key: "gym@mon" };
    const wednesday = { ...timed("gym", "2026-10-28T13:00:00Z", "2026-10-28T14:00:00Z"), key: "gym@wed" };
    const { columns } = build([monday, wednesday], ["2026-10-26", "2026-10-27", "2026-10-28"], "week");
    expect(columns.map((column) => column.timed.map((event) => event.key))).toEqual([["gym@mon"], [], ["gym@wed"]]);
    expect(columns[2].timed[0]).toMatchObject({ id: "gym", details: { dayLabel: "Wednesday, October 28" } });
  });

  it("hides the time on blocks under 45 minutes", () => {
    const { columns } = build([timed("short", "2026-10-28T18:00:00Z", "2026-10-28T18:30:00Z")], ["2026-10-28"]);
    expect(columns[0].timed[0].showTime).toBe(false);
  });

  it("puts all-day events on each day they cover, by UTC date", () => {
    const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"];
    const { columns } = build([allDay("trip", "2026-10-27", "2026-10-29")], days, "week");
    expect(columns.map((column) => column.allDay.map((event) => event.id))).toEqual([[], ["trip"], ["trip"], []]);
    expect(columns[1].timed).toEqual([]);
    expect(columns[1].allDay[0].details.timeLabel).toBe("All day");
  });

  it("uses short weekday headings in the week view", () => {
    const { columns } = build([], ["2026-10-26"], "week");
    expect(columns[0]).toMatchObject({ heading: "Mon", dayNumber: 26, isToday: false });
  });

  it("scrolls to an hour before the earliest timed event", () => {
    // 6:30 AM EDT on Oct 29; the all-day event doesn't count.
    const events = [
      timed("early", "2026-10-29T10:30:00Z", "2026-10-29T11:00:00Z"),
      allDay("x", "2026-10-28", "2026-10-29"),
    ];
    expect(build(events, ["2026-10-28", "2026-10-29"], "week").scrollHour).toBe(5);
    expect(build([], ["2026-10-28"]).scrollHour).toBe(7);
  });
});

describe("buildMonthDays", () => {
  const build = (events: EventView[], date = "2026-10-28") =>
    buildMonthDays({ events, date, today: "2026-10-28", tz: NY });
  const cell = (days: ReturnType<typeof build>, day: string) => days.find((d) => d.day === day)!;

  it("marks today and the days outside the month", () => {
    const days = build([]);
    expect(days[0]).toMatchObject({ day: "2026-09-28", dayNumber: 28, inMonth: false, isToday: false });
    expect(cell(days, "2026-10-01")).toMatchObject({ inMonth: true, label: "Thursday, October 1" });
    expect(cell(days, "2026-10-28")).toMatchObject({ isToday: true, chips: [], moreCount: 0 });
    expect(days[34]).toMatchObject({ day: "2026-11-01", inMonth: false });
  });

  it("shows two chips in query order and counts the rest", () => {
    // Query order: all-day first, then by start.
    const events = [
      allDay("holiday", "2026-10-28", "2026-10-29"),
      timed("standup", "2026-10-28T13:00:00Z", "2026-10-28T13:15:00Z"),
      timed("lunch", "2026-10-28T16:00:00Z", "2026-10-28T17:00:00Z"),
      timed("gym", "2026-10-28T22:00:00Z", "2026-10-28T23:00:00Z"),
    ];
    const day = cell(build(events), "2026-10-28");
    expect(day.chips.map((chip) => chip.id)).toEqual(["holiday", "standup"]);
    expect(day.moreCount).toBe(2);
    expect(day.chips[1].details.timeLabel).toBe("9:00 AM – 9:15 AM (15 min)");
  });

  it("places timed events by the New York day, not the UTC one", () => {
    // 9 PM Oct 27 in New York is Oct 28 in UTC.
    const days = build([timed("late", "2026-10-28T01:00:00Z", "2026-10-28T02:00:00Z")]);
    expect(cell(days, "2026-10-27").chips.map((chip) => chip.id)).toEqual(["late"]);
    expect(cell(days, "2026-10-28").chips).toEqual([]);
  });

  it("shows an event crossing midnight on both days", () => {
    const days = build([timed("late", "2026-10-28T02:00:00Z", "2026-10-28T05:00:00Z")]);
    expect(cell(days, "2026-10-27").chips).toHaveLength(1);
    expect(cell(days, "2026-10-28").chips).toHaveLength(1);
    expect(cell(days, "2026-10-29").chips).toHaveLength(0);
  });

  it("does not show an event ending at midnight on the next day", () => {
    // 11 PM to midnight Oct 28 in New York.
    const days = build([timed("a", "2026-10-29T03:00:00Z", "2026-10-29T04:00:00Z")]);
    expect(cell(days, "2026-10-28").chips).toHaveLength(1);
    expect(cell(days, "2026-10-29").chips).toHaveLength(0);
  });

  it("puts a multi-day all-day event on each day it covers, across the month edge", () => {
    const days = build([allDay("trip", "2026-10-31", "2026-11-02")]);
    const covered = days.filter((day) => day.chips.length > 0).map((day) => day.day);
    expect(covered).toEqual(["2026-10-31", "2026-11-01"]);
  });

  it("keeps a 9 AM event on Nov 1 when DST ends", () => {
    // 9 AM EST is 14:00 UTC.
    const days = build([timed("a", "2026-11-01T14:00:00Z", "2026-11-01T15:00:00Z")]);
    expect(cell(days, "2026-11-01").chips[0].details.timeLabel).toBe("9:00 AM – 10:00 AM (1h)");
  });
});
