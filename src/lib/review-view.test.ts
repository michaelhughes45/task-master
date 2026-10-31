import { describe, expect, it } from "vitest";
import {
  defaultReviewWeek,
  formatReadyAt,
  groupMissed,
  isReviewReady,
  lateItems,
  rateDelta,
  reviewReadyAt,
  reviewSummary,
  reviewWeekList,
} from "./review-view";
import type { ReviewDoneItem, ReviewTaskItem, WeeklyReview } from "@/types/review";

const NY = "America/New_York";

function review(overrides: Partial<WeeklyReview> = {}, totals: Partial<WeeklyReview["totals"]> = {}): WeeklyReview {
  return {
    weekStart: "2026-10-19",
    totals: { planned: 36, done: 28, rate: 78, doneLate: 3, missed: 8, open: 0, ...totals },
    daily: { planned: 0, done: 0, rate: null },
    weekly: { planned: 0, done: 0, rate: null },
    done: [],
    missed: [],
    minutesTracked: 860,
    timeByTask: [],
    perDay: [],
    mostMissed: [],
    notes: [],
    comparison: { previousRate: 72, rateChange: 6, previousMinutes: 790, minutesChange: 70 },
    ...overrides,
  };
}

describe("review readiness", () => {
  it("is ready on the week's Sunday at 7 PM in the user's zone", () => {
    expect(reviewReadyAt("2026-10-19", NY)).toEqual(new Date("2026-10-25T23:00:00Z"));
    // Any day of the week finds its Sunday.
    expect(reviewReadyAt("2026-10-22", NY)).toEqual(new Date("2026-10-25T23:00:00Z"));
    expect(reviewReadyAt("2026-10-19", "Pacific/Auckland")).toEqual(new Date("2026-10-25T06:00:00Z"));
  });

  it("keeps 7 PM on the Sunday clocks fall back", () => {
    // Nov 1, 2026: EDT ends at 2 AM, so 7 PM is EST (UTC−5).
    expect(reviewReadyAt("2026-10-26", NY)).toEqual(new Date("2026-11-02T00:00:00Z"));
    expect(formatReadyAt("2026-10-26", NY)).toBe("Sunday, Nov 1 at 7:00 PM");
  });

  it("switches exactly at 7 PM", () => {
    expect(isReviewReady("2026-10-26", NY, new Date("2026-11-01T23:59:59Z"))).toBe(false);
    expect(isReviewReady("2026-10-26", NY, new Date("2026-11-02T00:00:00Z"))).toBe(true);
  });

  it("opens last week until this week's review is ready", () => {
    // Saturday afternoon.
    expect(defaultReviewWeek(NY, new Date("2026-10-31T18:00:00Z"))).toBe("2026-10-19");
    // Sunday 6:59 PM EST.
    expect(defaultReviewWeek(NY, new Date("2026-11-01T23:59:00Z"))).toBe("2026-10-19");
    // Sunday 7 PM EST.
    expect(defaultReviewWeek(NY, new Date("2026-11-02T00:00:00Z"))).toBe("2026-10-26");
    // Monday 12:30 AM: a new week, so last week again.
    expect(defaultReviewWeek(NY, new Date("2026-11-02T05:30:00Z"))).toBe("2026-10-26");
  });

  it("uses the user's day, not UTC's", () => {
    // Monday 1 AM UTC is still Sunday 9 PM in New York: this week is ready there.
    expect(defaultReviewWeek(NY, new Date("2026-10-26T01:00:00Z"))).toBe("2026-10-19");
    // Already Monday in Auckland, where Sunday's review was ready long ago.
    expect(defaultReviewWeek("Pacific/Auckland", new Date("2026-10-26T01:00:00Z"))).toBe("2026-10-19");
    expect(defaultReviewWeek("UTC", new Date("2026-10-26T01:00:00Z"))).toBe("2026-10-19");
  });

  it("crosses a year boundary", () => {
    expect(defaultReviewWeek("UTC", new Date("2027-01-01T12:00:00Z"))).toBe("2026-12-21");
    expect(formatReadyAt("2026-12-28", "UTC")).toBe("Sunday, Jan 3 at 7:00 PM");
  });
});

describe("reviewWeekList", () => {
  const rates = new Map([
    ["2026-10-26", 36],
    ["2026-10-19", 78],
    ["2026-10-12", null],
  ]);

  it("leaves out this week until it's ready", () => {
    const list = reviewWeekList({
      weeks: ["2026-10-26", "2026-10-19", "2026-10-12"],
      rates,
      selected: "2026-10-19",
      latestReady: "2026-10-19",
    });
    expect(list).toEqual([
      { weekStart: "2026-10-19", label: "Oct 19 – 25", rate: 78 },
      { weekStart: "2026-10-12", label: "Oct 12 – 18", rate: null },
    ]);
  });

  it("includes this week once ready", () => {
    const list = reviewWeekList({
      weeks: ["2026-10-26", "2026-10-19"],
      rates,
      selected: "2026-10-26",
      latestReady: "2026-10-26",
    });
    expect(list.map((w) => w.weekStart)).toEqual(["2026-10-26", "2026-10-19"]);
  });

  it("adds the selected week in order even when nothing was planned", () => {
    const list = reviewWeekList({
      weeks: ["2026-10-19", "2026-10-05"],
      rates,
      selected: "2026-10-12",
      latestReady: "2026-10-19",
    });
    expect(list.map((w) => w.weekStart)).toEqual(["2026-10-19", "2026-10-12", "2026-10-05"]);
    expect(list[2].rate).toBeNull();
  });

  it("shows a selected week that isn't ready yet", () => {
    const list = reviewWeekList({ weeks: ["2026-10-26"], rates, selected: "2026-10-26", latestReady: "2026-10-19" });
    expect(list.map((w) => w.weekStart)).toEqual(["2026-10-26"]);
  });
});

describe("reviewSummary", () => {
  it("matches the mockup sentence", () => {
    expect(reviewSummary(review())).toBe(
      "You finished 28 of 36 tasks (78%), up from 72% the week before, and tracked 14h\u00a020m of work. 3 tasks were ticked off late.",
    );
  });

  it("says down and same", () => {
    const down = review({ comparison: { previousRate: 80, rateChange: -2, previousMinutes: 0, minutesChange: 0 } });
    expect(reviewSummary(down)).toContain("(78%), down from 80% the week before, and tracked");
    const same = review({ comparison: { previousRate: 78, rateChange: 0, previousMinutes: 0, minutesChange: 0 } });
    expect(reviewSummary(same)).toContain("(78%), the same as the week before, and tracked");
  });

  it("drops the comparison when there's no previous week", () => {
    expect(reviewSummary(review({ comparison: null }))).toBe(
      "You finished 28 of 36 tasks (78%) and tracked 14h\u00a020m of work. 3 tasks were ticked off late.",
    );
  });

  it("drops the time when none was tracked, and late when nothing was late", () => {
    expect(reviewSummary(review({ minutesTracked: 0 }, { doneLate: 0 }))).toBe(
      "You finished 28 of 36 tasks (78%), up from 72% the week before.",
    );
    expect(reviewSummary(review({ minutesTracked: 0, comparison: null }, { doneLate: 0 }))).toBe(
      "You finished 28 of 36 tasks (78%).",
    );
  });

  it("uses singulars and mentions open tasks", () => {
    const one = review({ minutesTracked: 0, comparison: null }, { planned: 1, done: 1, rate: 100, doneLate: 1 });
    expect(reviewSummary(one)).toBe("You finished 1 of 1 task (100%). 1 task was ticked off late.");
    const open = review({ minutesTracked: 0, comparison: null }, { doneLate: 0, open: 2 });
    expect(reviewSummary(open)).toBe("You finished 28 of 36 tasks (78%). 2 are still open.");
  });
});

describe("rateDelta", () => {
  it("reads the comparison", () => {
    expect(rateDelta(review())).toEqual({ direction: "up", points: 6 });
    const down = review({ comparison: { previousRate: 80, rateChange: -2, previousMinutes: 0, minutesChange: 0 } });
    expect(rateDelta(down)).toEqual({ direction: "down", points: 2 });
    const same = review({ comparison: { previousRate: 78, rateChange: 0, previousMinutes: 0, minutesChange: 0 } });
    expect(rateDelta(same)).toEqual({ direction: "same", points: 0 });
    expect(rateDelta(review({ comparison: null }))).toBeNull();
  });
});

function missed(taskId: string, title: string, day: string, scope: "DAILY" | "WEEKLY" = "DAILY"): ReviewTaskItem {
  return { taskId, title, scope, day };
}

describe("groupMissed", () => {
  it("groups days per task, daily first, weekly as Weekly", () => {
    const groups = groupMissed([
      missed("w1", "Clean the bathroom", "2026-10-19", "WEEKLY"),
      missed("bank", "Call the bank", "2026-10-19"),
      missed("read", "Read 20 pages", "2026-10-20"),
      missed("read", "Read 20 pages", "2026-10-22"),
      missed("read", "Read 20 pages", "2026-10-24"),
    ]);
    expect(groups).toEqual([
      { key: "DAILY:bank", title: "Call the bank", when: "Mon" },
      { key: "DAILY:read", title: "Read 20 pages", when: "Tue, Thu, Sat" },
      { key: "WEEKLY:w1", title: "Clean the bathroom", when: "Weekly" },
    ]);
  });

  it("is empty when nothing was missed", () => {
    expect(groupMissed([])).toEqual([]);
  });
});

function doneItem(overrides: Partial<ReviewDoneItem>): ReviewDoneItem {
  return {
    taskId: "t",
    title: "Task",
    scope: "DAILY",
    day: "2026-10-19",
    late: true,
    completedOn: "2026-10-20",
    minutesSpent: null,
    ...overrides,
  };
}

describe("lateItems", () => {
  it("names the day it was for and the day it was ticked", () => {
    const items = lateItems(
      [
        doneItem({ taskId: "read", title: "Read 20 pages" }),
        doneItem({ taskId: "ok", late: false }),
        doneItem({ taskId: "bill", title: "Pay phone bill", day: "2026-10-21", completedOn: "2026-10-23" }),
        doneItem({ taskId: "grocery", title: "Grocery run", scope: "WEEKLY", completedOn: "2026-10-26" }),
      ],
      "2026-10-19",
    );
    expect(items).toEqual([
      { key: "read@2026-10-19", title: "Read 20 pages (Mon)", when: "ticked Tue" },
      { key: "bill@2026-10-21", title: "Pay phone bill (Wed)", when: "ticked Fri" },
      { key: "grocery@2026-10-19", title: "Grocery run (weekly)", when: "ticked Mon, Oct 26" },
    ]);
  });

  it("gives the date for a daily task ticked after the week", () => {
    const [item] = lateItems([doneItem({ day: "2026-10-25", completedOn: "2026-11-03" })], "2026-10-19");
    expect(item.when).toBe("ticked Tue, Nov 3");
  });
});
