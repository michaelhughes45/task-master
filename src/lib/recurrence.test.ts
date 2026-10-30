import { describe, expect, it } from "vitest";
import { instantToWallTime, todayIn } from "@/lib/dates";
import {
  expandEvent,
  expandTask,
  isTaskOccurrence,
  type EventExceptionInput,
  type EventSeries,
  type TaskExceptionInput,
  type TaskSeries,
} from "@/lib/recurrence";

const NY = "America/New_York";
const AUCKLAND = "Pacific/Auckland";

function task(rrule: string | null, date = "2026-10-26", overrides: Partial<TaskSeries> = {}): TaskSeries {
  return { scope: "DAILY", date, rrule, title: "Read 20 pages", ...overrides };
}

const dates = (t: TaskSeries, first: string, last: string, exceptions: TaskExceptionInput[] = []) =>
  expandTask(t, exceptions, first, last).map((o) => o.date);

function taskException(occurrenceDate: string, overrides: Partial<TaskExceptionInput> = {}): TaskExceptionInput {
  return { occurrenceDate, cancelled: false, title: null, date: null, ...overrides };
}

function event(startAt: string, endAt: string, rrule: string | null, overrides: Partial<EventSeries> = {}): EventSeries {
  return {
    allDay: false,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    rrule,
    title: "Gym",
    notes: null,
    location: null,
    ...overrides,
  };
}

function eventException(occurrenceStart: string, overrides: Partial<EventExceptionInput> = {}): EventExceptionInput {
  return {
    occurrenceStart: new Date(occurrenceStart),
    cancelled: false,
    title: null,
    startAt: null,
    endAt: null,
    notes: null,
    location: null,
    ...overrides,
  };
}

const starts = (e: EventSeries, first: string, last: string, tz: string, exceptions: EventExceptionInput[] = []) =>
  expandEvent(e, exceptions, first, last, tz).map((o) => o.startAt.toISOString());

// "2026-03-08 09:00" for each occurrence, read on the zone's wall clock.
const wallStarts = (e: EventSeries, first: string, last: string, tz: string) =>
  expandEvent(e, [], first, last, tz).map((o) => `${todayIn(tz, o.startAt)} ${instantToWallTime(o.startAt, tz)}`);

describe("expandTask rules", () => {
  it("repeats daily", () => {
    expect(dates(task("FREQ=DAILY"), "2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("repeats every weekday, skipping the weekend", () => {
    expect(dates(task("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"), "2026-10-29", "2026-11-03")).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("repeats weekly on several days", () => {
    expect(dates(task("FREQ=WEEKLY;BYDAY=MO,WE,FR"), "2026-10-26", "2026-11-08")).toEqual([
      "2026-10-26",
      "2026-10-28",
      "2026-10-30",
      "2026-11-02",
      "2026-11-04",
      "2026-11-06",
    ]);
  });

  it("repeats every 2 weeks", () => {
    expect(dates(task("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU", "2026-10-27"), "2026-10-26", "2026-11-30")).toEqual([
      "2026-10-27",
      "2026-11-10",
      "2026-11-24",
    ]);
  });

  it("repeats monthly on the 31st, skipping shorter months", () => {
    expect(dates(task("FREQ=MONTHLY;BYMONTHDAY=31", "2026-01-31"), "2026-01-01", "2026-12-31")).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
      "2026-07-31",
      "2026-08-31",
      "2026-10-31",
      "2026-12-31",
    ]);
  });

  it("repeats monthly on the 4th Wednesday", () => {
    expect(dates(task("FREQ=MONTHLY;BYDAY=+4WE", "2026-10-28"), "2026-10-01", "2027-01-31")).toEqual([
      "2026-10-28",
      "2026-11-25",
      "2026-12-23",
      "2027-01-27",
    ]);
  });

  it("repeats monthly on the last Friday", () => {
    expect(dates(task("FREQ=MONTHLY;BYDAY=-1FR", "2026-10-30"), "2026-10-01", "2027-02-28")).toEqual([
      "2026-10-30",
      "2026-11-27",
      "2026-12-25",
      "2027-01-29",
      "2027-02-26",
    ]);
  });

  it("repeats yearly on Feb 29 in leap years only", () => {
    expect(dates(task("FREQ=YEARLY", "2028-02-29"), "2028-01-01", "2036-12-31")).toEqual([
      "2028-02-29",
      "2032-02-29",
      "2036-02-29",
    ]);
  });

  it("stops after COUNT occurrences, counted from the start", () => {
    expect(dates(task("FREQ=DAILY;COUNT=3"), "2026-10-27", "2026-11-30")).toEqual(["2026-10-27", "2026-10-28"]);
  });

  it("includes the UNTIL day", () => {
    expect(dates(task("FREQ=DAILY;UNTIL=20261028"), "2026-10-26", "2026-11-30")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
  });

  it("has nothing before the series starts", () => {
    expect(dates(task("FREQ=DAILY"), "2026-10-01", "2026-10-25")).toEqual([]);
  });

  it("expands an endless rule for a range far in the future", () => {
    expect(dates(task("FREQ=DAILY"), "2099-12-31", "2099-12-31")).toEqual(["2099-12-31"]);
  });

  it("shows a one-off task on its own day only", () => {
    expect(dates(task(null, "2026-10-28"), "2026-10-26", "2026-11-01")).toEqual(["2026-10-28"]);
    expect(dates(task(null, "2026-10-28"), "2026-10-29", "2026-11-01")).toEqual([]);
  });

  it("treats an unreadable or sub-daily rule as not repeating", () => {
    expect(dates(task("garbage"), "2026-10-26", "2026-10-30")).toEqual(["2026-10-26"]);
    expect(dates(task("FREQ=HOURLY"), "2026-10-26", "2026-10-30")).toEqual(["2026-10-26"]);
  });

  it("carries the task's own fields onto each occurrence", () => {
    const [occurrence] = expandTask({ ...task("FREQ=DAILY"), id: "t1" }, [], "2026-10-28", "2026-10-28");
    expect(occurrence).toMatchObject({ id: "t1", occurrenceDate: "2026-10-28", date: "2026-10-28", title: "Read 20 pages" });
  });
});

describe("expandTask weekly scope", () => {
  const weekly = (rrule: string | null, date = "2026-10-26") => task(rrule, date, { scope: "WEEKLY", title: "Long run" });
  const isMonday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay() === 1;

  it("produces Mondays only", () => {
    const result = dates(weekly("FREQ=WEEKLY"), "2026-10-26", "2026-11-22");
    expect(result).toEqual(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(result.every(isMonday)).toBe(true);
  });

  it("finds a week's occurrence from any day of it", () => {
    expect(dates(weekly("FREQ=WEEKLY"), "2026-11-05", "2026-11-05")).toEqual(["2026-11-02"]);
  });

  it("repeats every 2 weeks", () => {
    expect(dates(weekly("FREQ=WEEKLY;INTERVAL=2"), "2026-10-26", "2026-11-30")).toEqual([
      "2026-10-26",
      "2026-11-09",
      "2026-11-23",
    ]);
  });

  it("makes one occurrence a week even when the rule names several days", () => {
    const result = dates(weekly("FREQ=WEEKLY;BYDAY=WE,FR"), "2026-10-26", "2026-11-08");
    expect(result).toEqual(["2026-10-26", "2026-11-02"]);
  });

  it("counts COUNT in weeks, not in the days a BYDAY rule lands on", () => {
    expect(dates(weekly("FREQ=WEEKLY;BYDAY=MO,WE;COUNT=2"), "2026-10-26", "2026-11-30")).toEqual([
      "2026-10-26",
      "2026-11-02",
    ]);
    expect(dates(weekly("FREQ=WEEKLY;COUNT=3"), "2026-11-02", "2026-11-30")).toEqual(["2026-11-02", "2026-11-09"]);
  });

  it("puts a monthly weekly-task on the Monday of the week it falls in", () => {
    // The 1st of each month: Nov 1, 2026 is a Sunday, Dec 1 a Tuesday.
    // Jan 1, 2027 is a Friday, in the week of Dec 28.
    const result = dates(weekly("FREQ=MONTHLY;BYMONTHDAY=1"), "2026-10-26", "2026-12-31");
    expect(result).toEqual(["2026-10-26", "2026-11-30", "2026-12-28"]);
  });

  it("moves an occurrence to the Monday of the week it was moved to", () => {
    const result = expandTask(
      weekly("FREQ=WEEKLY"),
      [taskException("2026-11-02", { date: "2026-11-11" })],
      "2026-11-02",
      "2026-11-15",
    );
    expect(result.map((o) => [o.occurrenceDate, o.date])).toEqual([
      ["2026-11-02", "2026-11-09"],
      ["2026-11-09", "2026-11-09"],
    ]);
  });
});

describe("expandTask exceptions", () => {
  const read = task("FREQ=DAILY");

  it("drops a cancelled occurrence", () => {
    expect(dates(read, "2026-10-27", "2026-10-29", [taskException("2026-10-28", { cancelled: true })])).toEqual([
      "2026-10-27",
      "2026-10-29",
    ]);
  });

  it("renames one occurrence", () => {
    const result = expandTask(read, [taskException("2026-10-28", { title: "Read 40 pages" })], "2026-10-27", "2026-10-28");
    expect(result.map((o) => o.title)).toEqual(["Read 20 pages", "Read 40 pages"]);
  });

  it("moves an occurrence out of the range and keeps its original date as the key", () => {
    const moved = [taskException("2026-10-28", { date: "2026-11-05" })];
    expect(dates(read, "2026-10-27", "2026-10-29", moved)).toEqual(["2026-10-27", "2026-10-29"]);

    const later = expandTask(read, moved, "2026-11-05", "2026-11-05");
    expect(later.map((o) => [o.occurrenceDate, o.date])).toEqual([
      ["2026-10-28", "2026-11-05"],
      ["2026-11-05", "2026-11-05"],
    ]);
  });

  it("ignores an exception for a date the rule never produces", () => {
    const weekdays = task("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(dates(weekdays, "2026-11-02", "2026-11-02", [taskException("2026-10-31", { date: "2026-11-02" })])).toEqual([
      "2026-11-02",
    ]);
  });
});

describe("isTaskOccurrence", () => {
  const weekdays = task("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");

  it("accepts a date the rule produces and rejects others", () => {
    expect(isTaskOccurrence(weekdays, [], "2026-10-30")).toBe(true);
    expect(isTaskOccurrence(weekdays, [], "2026-10-31")).toBe(false);
    expect(isTaskOccurrence(weekdays, [], "2026-10-23")).toBe(false);
  });

  it("rejects a cancelled occurrence but accepts a moved one by its original date", () => {
    expect(isTaskOccurrence(weekdays, [taskException("2026-10-30", { cancelled: true })], "2026-10-30")).toBe(false);
    expect(isTaskOccurrence(weekdays, [taskException("2026-10-30", { date: "2026-10-31" })], "2026-10-30")).toBe(true);
  });

  it("accepts only its own day for a one-off task", () => {
    expect(isTaskOccurrence(task(null, "2026-10-28"), [], "2026-10-28")).toBe(true);
    expect(isTaskOccurrence(task(null, "2026-10-28"), [], "2026-10-29")).toBe(false);
  });

  it("accepts the week's Monday for a weekly series", () => {
    const run = task("FREQ=WEEKLY;INTERVAL=2", "2026-10-26", { scope: "WEEKLY" });
    expect(isTaskOccurrence(run, [], "2026-11-09")).toBe(true);
    expect(isTaskOccurrence(run, [], "2026-11-02")).toBe(false);
  });
});

describe("expandEvent across daylight saving", () => {
  it("keeps a 9:00 AM New York event at 9:00 AM when DST starts on Mar 8, 2026", () => {
    // 9:00 AM EST on Friday, Mar 6, every day for an hour.
    const gym = event("2026-03-06T14:00:00Z", "2026-03-06T15:00:00Z", "FREQ=DAILY");

    expect(wallStarts(gym, "2026-03-06", "2026-03-09", NY)).toEqual([
      "2026-03-06 09:00",
      "2026-03-07 09:00",
      "2026-03-08 09:00",
      "2026-03-09 09:00",
    ]);
    // So the UTC instant moves an hour earlier.
    expect(starts(gym, "2026-03-07", "2026-03-08", NY)).toEqual(["2026-03-07T14:00:00.000Z", "2026-03-08T13:00:00.000Z"]);
  });

  it("keeps a 9:00 AM New York event at 9:00 AM when DST ends on Nov 1, 2026", () => {
    const gym = event("2026-10-30T13:00:00Z", "2026-10-30T14:00:00Z", "FREQ=DAILY");

    expect(wallStarts(gym, "2026-10-30", "2026-11-02", NY)).toEqual([
      "2026-10-30 09:00",
      "2026-10-31 09:00",
      "2026-11-01 09:00",
      "2026-11-02 09:00",
    ]);
    expect(starts(gym, "2026-10-31", "2026-11-01", NY)).toEqual(["2026-10-31T13:00:00.000Z", "2026-11-01T14:00:00.000Z"]);
  });

  it("keeps the exact duration on every occurrence", () => {
    const gym = event("2026-10-30T13:00:00Z", "2026-10-30T13:45:00Z", "FREQ=DAILY");
    const durations = expandEvent(gym, [], "2026-10-30", "2026-11-02", NY).map(
      (o) => (o.endAt.getTime() - o.startAt.getTime()) / 60000,
    );
    expect(durations).toEqual([45, 45, 45, 45]);
  });

  it("keeps a first occurrence in the repeated fall-back hour at its stored instant", () => {
    // 1:30 AM EST on Nov 1, 2026 (the second 1:30 that night), then 1:30 AM EST each day.
    const late = event("2026-11-01T06:30:00Z", "2026-11-01T07:00:00Z", "FREQ=DAILY");
    expect(starts(late, "2026-11-01", "2026-11-02", NY)).toEqual(["2026-11-01T06:30:00.000Z", "2026-11-02T06:30:00.000Z"]);
  });

  it("moves an occurrence in the skipped spring-forward hour forward by the gap", () => {
    // 2:30 AM daily from Mar 7, 2026; 2:30 AM doesn't exist on Mar 8, so it's 3:30 AM EDT.
    const early = event("2026-03-07T07:30:00Z", "2026-03-07T08:00:00Z", "FREQ=DAILY");
    expect(wallStarts(early, "2026-03-07", "2026-03-09", NY)).toEqual([
      "2026-03-07 02:30",
      "2026-03-08 03:30",
      "2026-03-09 02:30",
    ]);
  });

  it("repeats on the user's wall time in a zone ahead of UTC", () => {
    // 7:00 AM Monday in Auckland is Sunday evening in UTC; Auckland's DST starts Sep 27, 2026.
    const run = event("2026-09-20T19:00:00Z", "2026-09-20T20:00:00Z", "FREQ=WEEKLY;BYDAY=MO");
    expect(wallStarts(run, "2026-09-21", "2026-10-05", AUCKLAND)).toEqual([
      "2026-09-21 07:00",
      "2026-09-28 07:00",
      "2026-10-05 07:00",
    ]);
  });
});

describe("expandEvent rules and ranges", () => {
  // 9:00–9:30 AM EDT on Monday, Oct 26.
  const standup = (rrule: string | null) => event("2026-10-26T13:00:00Z", "2026-10-26T13:30:00Z", rrule);

  it("includes the UNTIL day for an event later in the day", () => {
    expect(wallStarts(standup("FREQ=DAILY;UNTIL=20261028"), "2026-10-26", "2026-11-01", NY)).toEqual([
      "2026-10-26 09:00",
      "2026-10-27 09:00",
      "2026-10-28 09:00",
    ]);
  });

  it("stops after COUNT occurrences", () => {
    expect(wallStarts(standup("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=4"), "2026-10-26", "2026-11-30", NY)).toEqual([
      "2026-10-26 09:00",
      "2026-10-28 09:00",
      "2026-10-30 09:00",
      "2026-11-02 09:00",
    ]);
  });

  it("finds occurrences by the user's day, not the UTC one", () => {
    // 10 PM EDT on Monday is Tuesday in UTC.
    const late = event("2026-10-27T02:00:00Z", "2026-10-27T03:00:00Z", "FREQ=WEEKLY;BYDAY=MO");
    expect(wallStarts(late, "2026-11-02", "2026-11-02", NY)).toEqual(["2026-11-02 22:00"]);
    expect(starts(late, "2026-11-03", "2026-11-03", NY)).toEqual([]);
  });

  it("includes an occurrence that started the day before and runs past midnight", () => {
    // 11 PM to 1 AM EDT, every day.
    const night = event("2026-10-27T03:00:00Z", "2026-10-27T05:00:00Z", "FREQ=DAILY");
    expect(wallStarts(night, "2026-10-28", "2026-10-28", NY)).toEqual(["2026-10-27 23:00", "2026-10-28 23:00"]);
  });

  it("returns a one-off event only when it overlaps the range", () => {
    expect(starts(standup(null), "2026-10-26", "2026-10-26", NY)).toEqual(["2026-10-26T13:00:00.000Z"]);
    expect(starts(standup(null), "2026-10-27", "2026-10-27", NY)).toEqual([]);
  });

  it("has nothing before the series starts", () => {
    expect(starts(standup("FREQ=DAILY"), "2026-10-20", "2026-10-25", NY)).toEqual([]);
  });

  it("carries the event's own fields and the original start onto each occurrence", () => {
    const [occurrence] = expandEvent({ ...standup("FREQ=DAILY"), id: "e1" }, [], "2026-10-27", "2026-10-27", NY);
    expect(occurrence).toMatchObject({
      id: "e1",
      title: "Gym",
      occurrenceStart: new Date("2026-10-27T13:00:00Z"),
      startAt: new Date("2026-10-27T13:00:00Z"),
      endAt: new Date("2026-10-27T13:30:00Z"),
    });
  });
});

describe("expandEvent all-day", () => {
  const allDay = (first: string, next: string, rrule: string) =>
    event(`${first}T00:00:00Z`, `${next}T00:00:00Z`, rrule, { allDay: true, title: "Bins" });

  it("repeats on UTC dates whatever the zone", () => {
    const bins = allDay("2026-10-27", "2026-10-28", "FREQ=WEEKLY");
    for (const tz of [NY, AUCKLAND]) {
      expect(starts(bins, "2026-10-26", "2026-11-08", tz)).toEqual([
        "2026-10-27T00:00:00.000Z",
        "2026-11-03T00:00:00.000Z",
      ]);
    }
  });

  it("includes a multi-day occurrence that started before the range", () => {
    // Friday to Sunday every week.
    const weekend = allDay("2026-10-30", "2026-11-02", "FREQ=WEEKLY");
    expect(starts(weekend, "2026-11-08", "2026-11-08", NY)).toEqual(["2026-11-06T00:00:00.000Z"]);
    expect(starts(weekend, "2026-11-09", "2026-11-12", NY)).toEqual([]);
  });

  it("repeats yearly on Feb 29 in leap years only", () => {
    const leap = allDay("2028-02-29", "2028-03-01", "FREQ=YEARLY");
    expect(starts(leap, "2028-01-01", "2033-12-31", AUCKLAND)).toEqual([
      "2028-02-29T00:00:00.000Z",
      "2032-02-29T00:00:00.000Z",
    ]);
  });
});

describe("expandEvent exceptions", () => {
  // 7:30–8:15 AM EDT, Mon/Wed/Fri from Oct 26.
  const gym = event("2026-10-26T11:30:00Z", "2026-10-26T12:15:00Z", "FREQ=WEEKLY;BYDAY=MO,WE,FR");
  const WEDNESDAY = "2026-10-28T11:30:00Z";

  it("drops a cancelled occurrence", () => {
    expect(starts(gym, "2026-10-26", "2026-11-01", NY, [eventException(WEDNESDAY, { cancelled: true })])).toEqual([
      "2026-10-26T11:30:00.000Z",
      "2026-10-30T11:30:00.000Z",
    ]);
  });

  it("overrides title, location and notes on one occurrence", () => {
    const result = expandEvent(
      gym,
      [eventException(WEDNESDAY, { title: "Swim", location: "Pool", notes: "Bring goggles" })],
      "2026-10-28",
      "2026-10-28",
      NY,
    );
    expect(result).toEqual([
      expect.objectContaining({ title: "Swim", location: "Pool", notes: "Bring goggles", startAt: new Date(WEDNESDAY) }),
    ]);
  });

  it("moves an occurrence to another day, keeping its original start as the key", () => {
    // Wednesday's session moved to Thursday 6 PM EDT; the end follows the series' duration.
    const moved = [eventException(WEDNESDAY, { startAt: new Date("2026-10-29T22:00:00Z") })];

    expect(starts(gym, "2026-10-28", "2026-10-28", NY, moved)).toEqual([]);
    expect(expandEvent(gym, moved, "2026-10-29", "2026-10-29", NY)).toEqual([
      expect.objectContaining({
        occurrenceStart: new Date(WEDNESDAY),
        startAt: new Date("2026-10-29T22:00:00Z"),
        endAt: new Date("2026-10-29T22:45:00Z"),
      }),
    ]);
  });

  it("brings in an occurrence moved from far outside the range", () => {
    const moved = [
      eventException(WEDNESDAY, {
        startAt: new Date("2026-12-15T15:00:00Z"),
        endAt: new Date("2026-12-15T16:00:00Z"),
      }),
    ];
    expect(starts(gym, "2026-12-15", "2026-12-15", NY, moved)).toEqual(["2026-12-15T15:00:00.000Z"]);
  });

  it("ignores an exception for a start the rule never produces", () => {
    const stray = [eventException("2026-10-27T11:30:00Z", { startAt: new Date("2026-10-27T11:30:00Z") })];
    expect(starts(gym, "2026-10-27", "2026-10-27", NY, stray)).toEqual([]);
  });
});
