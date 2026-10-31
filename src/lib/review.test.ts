import { describe, expect, it } from "vitest";
import { expandTask } from "@/lib/recurrence";
import { completionRate, computeWeeklyReview } from "@/lib/review";
import type { DateStr } from "@/types/dates";
import type { ReviewCompletion, ReviewOccurrence, WeeklyReviewInput } from "@/types/review";

const NY = "America/New_York";
const MONDAY = "2026-10-19";
const DAYS = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];

function occ(overrides: Partial<ReviewOccurrence> = {}): ReviewOccurrence {
  return {
    taskId: "t1",
    title: "Pay bill",
    scope: "DAILY",
    day: "2026-10-21",
    repeats: false,
    completion: null,
    ...overrides,
  };
}

// Ticked at the given instant; the default is noon EDT on the 21st.
function done(iso = "2026-10-21T16:00:00Z", extra: Partial<ReviewCompletion> = {}): ReviewCompletion {
  return { completedAt: new Date(iso), minutesSpent: null, workNote: null, ...extra };
}

function review(occurrences: ReviewOccurrence[], overrides: Partial<WeeklyReviewInput> = {}) {
  return computeWeeklyReview({
    weekStart: MONDAY,
    occurrences,
    previous: null,
    today: "2026-10-30",
    tz: NY,
    ...overrides,
  });
}

// A daily task repeating every day of the week, done on the given days.
function everyDay(taskId: string, title: string, doneOn: DateStr[]) {
  return DAYS.map((day) =>
    occ({ taskId, title, day, repeats: true, completion: doneOn.includes(day) ? done(`${day}T16:00:00Z`) : null }),
  );
}

describe("completionRate", () => {
  it("rounds to a whole percent and is null with nothing planned", () => {
    expect(completionRate(0, 0)).toBeNull();
    expect(completionRate(2, 3)).toBe(67);
    expect(completionRate(1, 3)).toBe(33);
    expect(completionRate(1, 8)).toBe(13);
    expect(completionRate(5, 5)).toBe(100);
  });
});

describe("computeWeeklyReview", () => {
  it("returns empty numbers for an empty week", () => {
    const result = review([], { previous: [] });
    expect(result.weekStart).toBe(MONDAY);
    expect(result.totals).toEqual({ planned: 0, done: 0, rate: null, doneLate: 0, missed: 0, open: 0 });
    expect(result.daily.rate).toBeNull();
    expect(result.weekly.rate).toBeNull();
    expect(result.minutesTracked).toBe(0);
    expect(result.perDay).toEqual(DAYS.map((day) => ({ day, planned: 0, done: 0 })));
    expect(result.timeByTask).toEqual([]);
    expect(result.mostMissed).toEqual([]);
    expect(result.notes).toEqual([]);
    expect(result.comparison).toBeNull();
  });

  it("snaps any day of the week to its Monday", () => {
    expect(review([], { weekStart: "2026-10-25" }).weekStart).toBe(MONDAY);
  });

  it("gives 100% when everything is done", () => {
    const result = review([
      occ({ taskId: "a", day: "2026-10-19", completion: done("2026-10-19T16:00:00Z") }),
      occ({ taskId: "b", day: "2026-10-23", completion: done("2026-10-23T16:00:00Z") }),
      occ({ taskId: "w", scope: "WEEKLY", day: MONDAY, completion: done("2026-10-22T16:00:00Z") }),
    ]);
    expect(result.totals).toMatchObject({ planned: 3, done: 3, rate: 100, missed: 0, doneLate: 0, open: 0 });
    expect(result.daily).toEqual({ planned: 2, done: 2, rate: 100 });
    expect(result.weekly).toEqual({ planned: 1, done: 1, rate: 100 });
    expect(result.missed).toEqual([]);
  });

  it("counts late completions as done and marks them late by the user's zone", () => {
    const result = review([
      // 11:30 PM EDT on the day: on time.
      occ({ taskId: "a", title: "On time", completion: done("2026-10-22T03:30:00Z") }),
      // 12:30 AM EDT the next day: late.
      occ({ taskId: "b", title: "Just late", completion: done("2026-10-22T04:30:00Z") }),
      occ({ taskId: "c", title: "Missed" }),
      // Weekly: Sunday 11 PM EDT is on time, Monday 12:30 AM is late.
      occ({ taskId: "w1", title: "Weekly on time", scope: "WEEKLY", day: MONDAY, completion: done("2026-10-26T03:00:00Z") }),
      occ({ taskId: "w2", title: "Weekly late", scope: "WEEKLY", day: MONDAY, completion: done("2026-10-26T04:30:00Z") }),
      occ({ taskId: "w3", title: "Weekly missed", scope: "WEEKLY", day: MONDAY }),
    ]);
    expect(result.totals).toMatchObject({ planned: 6, done: 4, rate: 67, doneLate: 2, missed: 2, open: 0 });
    expect(result.daily).toEqual({ planned: 3, done: 2, rate: 67 });
    expect(result.weekly).toEqual({ planned: 3, done: 2, rate: 67 });
    expect(result.done.map((d) => [d.title, d.late])).toEqual([
      ["Weekly on time", false],
      ["Weekly late", true],
      ["On time", false],
      ["Just late", true],
    ]);
    expect(result.missed.map((m) => m.title)).toEqual(["Weekly missed", "Missed"]);
    expect(result.done.map((d) => d.completedOn)).toEqual(["2026-10-25", "2026-10-26", "2026-10-21", "2026-10-22"]);
  });

  it("counts a weekly task once for the week and ignores occurrences from other weeks", () => {
    const result = review([
      occ({ taskId: "w", scope: "WEEKLY", day: MONDAY }),
      occ({ taskId: "w", scope: "WEEKLY", day: "2026-10-12", completion: done("2026-10-13T16:00:00Z") }),
      occ({ taskId: "a", day: "2026-10-18" }),
      occ({ taskId: "a", day: "2026-10-26" }),
    ]);
    expect(result.totals).toMatchObject({ planned: 1, done: 0, missed: 1 });
    expect(result.weekly).toEqual({ planned: 1, done: 0, rate: 0 });
    expect(result.daily.planned).toBe(0);
    // Weekly tasks are not in the per-day bars.
    expect(result.perDay.every((d) => d.planned === 0)).toBe(true);
  });

  it("leaves cancelled occurrences of a repeating task out of planned", () => {
    const series = { scope: "DAILY" as const, date: "2026-10-01", rrule: "FREQ=DAILY", title: "Stretch" };
    const exceptions = [{ occurrenceDate: "2026-10-21", cancelled: true, title: null, date: null }];
    const occurrences = expandTask(series, exceptions, DAYS[0], DAYS[6]).map((o) =>
      occ({ taskId: "s", title: o.title, day: o.date, repeats: true }),
    );
    const result = review(occurrences);
    expect(result.totals.planned).toBe(6);
    expect(result.perDay.find((d) => d.day === "2026-10-21")).toEqual({ day: "2026-10-21", planned: 0, done: 0 });
    expect(result.mostMissed).toEqual([{ taskId: "s", title: "Stretch", scope: "DAILY", missed: 6, planned: 6 }]);
  });

  it("splits planned and done daily occurrences by day", () => {
    const result = review(everyDay("s", "Stretch", ["2026-10-19", "2026-10-20"]).concat(occ({ day: "2026-10-19" })));
    expect(result.perDay[0]).toEqual({ day: "2026-10-19", planned: 2, done: 1 });
    expect(result.perDay[1]).toEqual({ day: "2026-10-20", planned: 1, done: 1 });
    expect(result.perDay[6]).toEqual({ day: "2026-10-25", planned: 1, done: 0 });
  });

  it("reports a repeating task missed 3 of 7 and ranks by misses, then share missed", () => {
    const result = review([
      ...everyDay("s", "Stretch", ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]),
      // 3 of 3 missed: same count as Stretch, higher share.
      ...["2026-10-19", "2026-10-21", "2026-10-23"].map((day) => occ({ taskId: "g", title: "Gym", day, repeats: true })),
      ...everyDay("r", "Read", ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]),
      ...everyDay("i", "Inbox", ["2026-10-19"]),
      // Never repeats: not in the list, however often missed.
      occ({ taskId: "o", title: "One-off" }),
      // Repeating but all done: not in the list.
      ...everyDay("d", "Done all", DAYS),
    ]);
    expect(result.mostMissed).toEqual([
      { taskId: "i", title: "Inbox", scope: "DAILY", missed: 6, planned: 7 },
      { taskId: "g", title: "Gym", scope: "DAILY", missed: 3, planned: 3 },
      { taskId: "s", title: "Stretch", scope: "DAILY", missed: 3, planned: 7 },
    ]);
  });

  it("treats not-done occurrences whose day or week isn't over as open, not missed", () => {
    const result = review(
      [
        occ({ taskId: "a", day: "2026-10-20" }),
        occ({ taskId: "b", day: "2026-10-22" }),
        occ({ taskId: "c", day: "2026-10-24" }),
        occ({ taskId: "w", scope: "WEEKLY", day: MONDAY, repeats: true }),
        occ({ taskId: "r", day: "2026-10-23", repeats: true }),
      ],
      { today: "2026-10-22" },
    );
    expect(result.totals).toMatchObject({ planned: 5, done: 0, rate: 0, missed: 1, open: 4 });
    expect(result.missed.map((m) => m.taskId)).toEqual(["a"]);
    expect(result.mostMissed).toEqual([]);
  });

  it("sums minutes, skipping nulls, and ranks the top 5 tasks by time", () => {
    const minutes = (taskId: string, title: string, day: DateStr, minutesSpent: number | null) =>
      occ({ taskId, title, day, completion: done(`${day}T16:00:00Z`, { minutesSpent }) });
    const result = review([
      minutes("a", "Write", "2026-10-19", 30),
      minutes("a", "Write more", "2026-10-20", 45),
      minutes("b", "Read", "2026-10-19", null),
      minutes("c", "Call", "2026-10-19", 20),
      minutes("d", "Plan", "2026-10-19", 10),
      minutes("e", "Run", "2026-10-19", 60),
      minutes("f", "Cook", "2026-10-19", 15),
      minutes("g", "Zero", "2026-10-19", 0),
      occ({ taskId: "h", scope: "WEEKLY", day: MONDAY, completion: done("2026-10-21T16:00:00Z", { minutesSpent: 5 }) }),
    ]);
    expect(result.minutesTracked).toBe(185);
    expect(result.timeByTask).toEqual([
      { taskId: "a", title: "Write more", minutes: 75 },
      { taskId: "e", title: "Run", minutes: 60 },
      { taskId: "c", title: "Call", minutes: 20 },
      { taskId: "f", title: "Cook", minutes: 15 },
      { taskId: "d", title: "Plan", minutes: 10 },
    ]);
  });

  it("lists work notes in date order with day, title and minutes", () => {
    const result = review([
      occ({ taskId: "b", title: "Thu task", day: "2026-10-22", completion: done("2026-10-22T16:00:00Z", { workNote: "Thu" }) }),
      occ({ taskId: "a", title: "Mon task", day: "2026-10-19", completion: done("2026-10-24T16:00:00Z", { workNote: "Mon, ticked Sat", minutesSpent: 25 }) }),
      occ({ taskId: "c", title: "No note", day: "2026-10-20", completion: done("2026-10-20T16:00:00Z", { workNote: null }) }),
      // Weekly: ticked Wednesday at 9 PM EDT (01:00 UTC Thursday).
      occ({ taskId: "w", title: "Weekly", scope: "WEEKLY", day: MONDAY, completion: done("2026-10-22T01:00:00Z", { workNote: "Wed" }) }),
      // Weekly ticked late, the next Tuesday: kept on Sunday.
      occ({ taskId: "w2", title: "Weekly late", scope: "WEEKLY", day: MONDAY, completion: done("2026-10-27T16:00:00Z", { workNote: "Late" }) }),
    ]);
    expect(result.notes).toEqual([
      { day: "2026-10-19", taskId: "a", title: "Mon task", scope: "DAILY", minutesSpent: 25, note: "Mon, ticked Sat" },
      { day: "2026-10-21", taskId: "w", title: "Weekly", scope: "WEEKLY", minutesSpent: null, note: "Wed" },
      { day: "2026-10-22", taskId: "b", title: "Thu task", scope: "DAILY", minutesSpent: null, note: "Thu" },
      { day: "2026-10-25", taskId: "w2", title: "Weekly late", scope: "WEEKLY", minutesSpent: null, note: "Late" },
    ]);
  });

  it("orders notes on the same day by when they were ticked", () => {
    const result = review([
      occ({ taskId: "a", title: "Later", completion: done("2026-10-21T20:00:00Z", { workNote: "2" }) }),
      occ({ taskId: "b", title: "Earlier", completion: done("2026-10-21T14:00:00Z", { workNote: "1" }) }),
    ]);
    expect(result.notes.map((n) => n.note)).toEqual(["1", "2"]);
  });

  describe("comparison with the previous week", () => {
    const thisWeek = [
      occ({ taskId: "a", day: "2026-10-19", completion: done("2026-10-19T16:00:00Z", { minutesSpent: 90 }) }),
      occ({ taskId: "b", day: "2026-10-20", completion: done("2026-10-20T16:00:00Z", { minutesSpent: 30 }) }),
      occ({ taskId: "c", day: "2026-10-21" }),
      occ({ taskId: "d", day: "2026-10-22", completion: done("2026-10-22T16:00:00Z") }),
    ];

    it("is null when the previous week wasn't loaded", () => {
      expect(review(thisWeek).comparison).toBeNull();
    });

    it("is null when the previous week had nothing planned", () => {
      // Occurrences from this week don't count for the week before.
      expect(review(thisWeek, { previous: thisWeek }).comparison).toBeNull();
    });

    it("gives the change in percentage points and minutes", () => {
      const previous = [
        occ({ taskId: "a", day: "2026-10-12", completion: done("2026-10-12T16:00:00Z", { minutesSpent: 60 }) }),
        occ({ taskId: "b", day: "2026-10-13" }),
        occ({ taskId: "w", scope: "WEEKLY", day: "2026-10-12", completion: done("2026-10-14T16:00:00Z", { minutesSpent: null }) }),
      ];
      // This week 3/4 = 75%; last week 2/3 = 67%.
      expect(review(thisWeek, { previous: [...previous, ...thisWeek] }).comparison).toEqual({
        previousRate: 67,
        rateChange: 8,
        previousMinutes: 60,
        minutesChange: 60,
      });
    });

    it("has no rate change when this week has nothing planned", () => {
      const previous = [occ({ day: "2026-10-12", completion: done("2026-10-12T16:00:00Z", { minutesSpent: 15 }) })];
      expect(review([], { previous }).comparison).toEqual({
        previousRate: 100,
        rateChange: null,
        previousMinutes: 15,
        minutesChange: -15,
      });
    });
  });

  it("marks a tick after midnight in Auckland late though it's the same UTC date", () => {
    const result = review(
      [
        // 11:30 PM NZDT on the 21st = 10:30 UTC.
        occ({ taskId: "a", completion: done("2026-10-21T10:30:00Z") }),
        // 12:30 AM NZDT on the 22nd = 11:30 UTC on the 21st.
        occ({ taskId: "b", completion: done("2026-10-21T11:30:00Z") }),
      ],
      { tz: "Pacific/Auckland" },
    );
    expect(result.done.map((d) => [d.taskId, d.late])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });

  it("uses the user's zone across the fall-back weekend", () => {
    // Week of Oct 26 – Nov 1, 2026; DST ends Sunday Nov 1 in New York.
    const sunday = "2026-11-01";
    const result = review(
      [
        // 11:30 PM EST Sunday = 04:30 UTC Monday: still on time.
        occ({ taskId: "a", day: sunday, completion: done("2026-11-02T04:30:00Z") }),
        // 12:30 AM EST Monday = 05:30 UTC: late.
        occ({ taskId: "b", day: sunday, completion: done("2026-11-02T05:30:00Z") }),
        occ({ taskId: "w", scope: "WEEKLY", day: "2026-10-26", completion: done("2026-11-02T04:30:00Z", { workNote: "x" }) }),
      ],
      { weekStart: "2026-10-28", today: "2026-11-05" },
    );
    expect(result.weekStart).toBe("2026-10-26");
    expect(result.done.map((d) => [d.taskId, d.late])).toEqual([
      ["w", false],
      ["a", false],
      ["b", true],
    ]);
    expect(result.notes[0].day).toBe(sunday);
    expect(result.perDay[6]).toEqual({ day: sunday, planned: 2, done: 2 });
  });
});
