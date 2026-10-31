import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { task: { findMany: vi.fn() }, taskCompletion: { findMany: vi.fn() } },
}));

const { prisma } = await import("@/lib/prisma");
const { getReviewWeeks, getWeekRates, getWeeklyReview } = await import("./review");

const findMany = vi.mocked(prisma.task.findMany);
const findCompletions = vi.mocked(prisma.taskCompletion.findMany);
const day = (value: string) => new Date(`${value}T00:00:00Z`);
const NY = "America/New_York";
// Friday, Oct 30, 2026, noon EDT.
const NOW = new Date("2026-10-30T16:00:00Z");

interface Row {
  id: string;
  title: string;
  scope: "DAILY" | "WEEKLY";
  date: Date;
  rrule: string | null;
  exceptions: Array<{ occurrenceDate: Date; cancelled: boolean; title: string | null; date: Date | null }>;
  completions: Array<{ occurrenceDate: Date; completedAt: Date; minutesSpent: number | null; workNote: string | null }>;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "task-1",
    title: "Pay bill",
    scope: "DAILY",
    date: day("2026-10-21"),
    rrule: null,
    exceptions: [],
    completions: [],
    ...overrides,
  };
}

const full = (r: Row) => ({ notes: null, priority: "NORMAL", ...r });

function done(occurrenceDate: string, completedAt: string, minutesSpent: number | null = null) {
  return { occurrenceDate: day(occurrenceDate), completedAt: new Date(completedAt), minutesSpent, workNote: null };
}

// Routes the task query by scope, like the database would.
function tasksByScope(rows: Row[]) {
  findMany.mockImplementation(((args: { where: { scope?: string } }) =>
    Promise.resolve(rows.filter((r) => r.scope === args.where.scope).map(full))) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  findCompletions.mockResolvedValue([]);
});

describe("getWeeklyReview", () => {
  it("loads this week and the one before in one query per scope", async () => {
    await getWeeklyReview("user-1", "2026-10-21", NY, NOW);

    const wheres = findMany.mock.calls.map(([args]) => args?.where);
    expect(wheres).toHaveLength(2);
    expect(wheres).toContainEqual({
      userId: "user-1",
      scope: "DAILY",
      OR: [
        { rrule: null, date: { gte: day("2026-10-12"), lte: day("2026-10-25") } },
        { rrule: { not: null }, date: { lte: day("2026-10-25") } },
      ],
    });
    expect(wheres).toContainEqual({
      userId: "user-1",
      scope: "WEEKLY",
      OR: [
        { rrule: null, date: { gte: day("2026-10-12"), lte: day("2026-10-19") } },
        { rrule: { not: null }, date: { lte: day("2026-10-19") } },
      ],
    });
  });

  it("reviews the week of repeating and one-off tasks against the previous week", async () => {
    tasksByScope([
      // Every day from Oct 12; Oct 21 cancelled; done Oct 12, 13 and 19 (the 19th ticked late).
      row({
        id: "stretch",
        title: "Stretch",
        date: day("2026-10-12"),
        rrule: "FREQ=DAILY",
        exceptions: [{ occurrenceDate: day("2026-10-21"), cancelled: true, title: null, date: null }],
        completions: [
          done("2026-10-12", "2026-10-12T16:00:00Z", 10),
          done("2026-10-13", "2026-10-13T16:00:00Z", 10),
          done("2026-10-19", "2026-10-20T16:00:00Z", 15),
        ],
      }),
      row({ id: "bill", title: "Pay bill", completions: [done("2026-10-21", "2026-10-21T16:00:00Z", 5)] }),
      row({ id: "run", title: "Long run", scope: "WEEKLY", date: day("2026-10-12"), rrule: "FREQ=WEEKLY" }),
    ]);

    const result = await getWeeklyReview("user-1", "2026-10-19", NY, NOW);

    // This week: 6 stretch + bill + run = 8 planned, 2 done.
    expect(result.totals).toMatchObject({ planned: 8, done: 2, rate: 25, doneLate: 1, missed: 6, open: 0 });
    expect(result.daily).toEqual({ planned: 7, done: 2, rate: 29 });
    expect(result.weekly).toEqual({ planned: 1, done: 0, rate: 0 });
    expect(result.minutesTracked).toBe(20);
    expect(result.mostMissed).toEqual([
      { taskId: "stretch", title: "Stretch", scope: "DAILY", missed: 5, planned: 6 },
      { taskId: "run", title: "Long run", scope: "WEEKLY", missed: 1, planned: 1 },
    ]);
    // Last week: 7 stretch + run = 8 planned, 2 done = 25%, 20 minutes.
    expect(result.comparison).toEqual({ previousRate: 25, rateChange: 0, previousMinutes: 20, minutesChange: 0 });
  });

  it("counts an occurrence moved into the week there, with its completion", async () => {
    tasksByScope([
      // Sundays from Oct 4; the Oct 18 one moved to Monday the 19th and ticked that day.
      row({
        id: "plan",
        title: "Plan week",
        date: day("2026-10-04"),
        rrule: "FREQ=WEEKLY;BYDAY=SU",
        exceptions: [{ occurrenceDate: day("2026-10-18"), cancelled: false, title: null, date: day("2026-10-19") }],
        // Keyed by the date the series produced, inside the two-week window.
        completions: [done("2026-10-18", "2026-10-19T16:00:00Z", 25)],
      }),
    ]);

    const result = await getWeeklyReview("user-1", "2026-10-19", NY, NOW);

    // Moved in on Monday plus its own Sunday, Oct 25.
    expect(result.perDay[0]).toEqual({ day: "2026-10-19", planned: 1, done: 1 });
    expect(result.perDay[6]).toEqual({ day: "2026-10-25", planned: 1, done: 0 });
    expect(result.done).toEqual([expect.objectContaining({ day: "2026-10-19", late: false, minutesSpent: 25 })]);
    // The week before lost its only occurrence (Sunday the 18th) to this week.
    expect(result.comparison).toBeNull();
  });

  it("treats this week's remaining days as open", async () => {
    tasksByScope([row({ id: "stretch", title: "Stretch", date: day("2026-10-26"), rrule: "FREQ=DAILY" })]);

    const result = await getWeeklyReview("user-1", "2026-10-26", NY, NOW);

    // Mon–Thu missed; Fri (today), Sat and Sun still open.
    expect(result.totals).toMatchObject({ planned: 7, done: 0, missed: 4, open: 3 });
    expect(result.comparison).toBeNull();
  });
});

describe("getWeekRates", () => {
  it("loads all the weeks in one query per scope and rates each", async () => {
    tasksByScope([
      // Every day from Oct 5; done every day of the week of Oct 19 and on Oct 12.
      row({
        id: "stretch",
        title: "Stretch",
        date: day("2026-10-05"),
        rrule: "FREQ=DAILY",
        completions: [
          done("2026-10-12", "2026-10-12T16:00:00Z"),
          ...["19", "20", "21", "22", "23", "24", "25"].map((d) => done(`2026-10-${d}`, `2026-10-${d}T16:00:00Z`)),
        ],
      }),
      row({ id: "run", title: "Long run", scope: "WEEKLY", date: day("2026-10-19") }),
    ]);

    const rates = await getWeekRates("user-1", ["2026-10-19", "2026-10-05", "2026-10-12"], NY, NOW);

    const wheres = findMany.mock.calls.map(([args]) => args?.where);
    expect(wheres).toHaveLength(2);
    expect(wheres).toContainEqual(
      expect.objectContaining({
        scope: "DAILY",
        OR: [
          { rrule: null, date: { gte: day("2026-10-05"), lte: day("2026-10-25") } },
          { rrule: { not: null }, date: { lte: day("2026-10-25") } },
        ],
      }),
    );
    // 7 of 8 (the weekly run wasn't done), 1 of 7, 0 of 7.
    expect([...rates]).toEqual([
      ["2026-10-19", 88],
      ["2026-10-05", 0],
      ["2026-10-12", 14],
    ]);
  });

  it("gives null for a week with nothing planned and skips the query for no weeks", async () => {
    expect(await getWeekRates("user-1", [], NY, NOW)).toEqual(new Map());
    expect(findMany).not.toHaveBeenCalled();
    expect(await getWeekRates("user-1", ["2026-10-19"], NY, NOW)).toEqual(new Map([["2026-10-19", null]]));
  });
});

describe("getReviewWeeks", () => {
  type Args = { where: { rrule: null | object }; take?: number };

  function weeksFrom(oneOffDates: string[], series: Row[]) {
    findMany.mockImplementation(((args: Args) =>
      Promise.resolve(
        args.where.rrule === null ? oneOffDates.map((d) => ({ date: day(d) })) : series,
      )) as never);
  }

  it("asks for one-off days up to this week's Sunday, newest first, and this user's series", async () => {
    await getReviewWeeks("user-1", NY, NOW);

    const [oneOffs, series] = findMany.mock.calls.map(([args]) => args);
    expect(oneOffs).toMatchObject({
      where: { userId: "user-1", rrule: null, date: { lte: day("2026-11-01") } },
      distinct: ["date"],
      orderBy: { date: "desc" },
      take: 84,
    });
    expect(series?.where).toEqual({ userId: "user-1", rrule: { not: null }, date: { lte: day("2026-11-01") } });
  });

  it("is empty for a user with no tasks", async () => {
    expect(await getReviewWeeks("user-1", NY, NOW)).toEqual([]);
  });

  it("collects the weeks of one-off tasks, newest first, once each", async () => {
    weeksFrom(["2026-11-01", "2026-10-28", "2026-10-26", "2026-10-04", "2026-09-30"], []);

    expect(await getReviewWeeks("user-1", NY, NOW)).toEqual(["2026-10-26", "2026-09-28"]);
  });

  it("adds the weeks a repeating series lands in, skipping cancelled and ended weeks", async () => {
    weeksFrom(
      ["2026-08-05"],
      [
        // Every 2 weeks from Mon Sep 7 until Oct 5: Sep 7, Sep 21, Oct 5; Sep 21 cancelled.
        row({
          date: day("2026-09-07"),
          rrule: "FREQ=WEEKLY;INTERVAL=2;UNTIL=20261005",
          exceptions: [{ occurrenceDate: day("2026-09-21"), cancelled: true, title: null, date: null }],
        }),
        // A weekly-list series that starts this week.
        row({ scope: "WEEKLY", date: day("2026-10-26"), rrule: "FREQ=WEEKLY;COUNT=1" }),
      ],
    );

    expect(await getReviewWeeks("user-1", NY, NOW)).toEqual(["2026-10-26", "2026-10-05", "2026-09-07", "2026-08-03"]);
  });

  it("returns at most 12 weeks and doesn't expand series before the 12th one-off week", async () => {
    const mondays = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 26 - 7 * i));
      return d.toISOString().slice(0, 10);
    });
    weeksFrom(mondays, [row({ date: day("2020-01-01"), rrule: "FREQ=DAILY" })]);

    const weeks = await getReviewWeeks("user-1", NY, NOW);

    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toBe("2026-10-26");
    expect(weeks[11]).toBe(mondays[11]);
  });

  it("finds this week from the user's zone", async () => {
    // Sunday 11 PM in New York is already Monday in UTC.
    weeksFrom(["2026-11-01"], []);

    expect(await getReviewWeeks("user-1", NY, new Date("2026-11-02T04:00:00Z"))).toEqual(["2026-10-26"]);
    expect(findMany.mock.calls[0][0]?.where).toMatchObject({ date: { lte: day("2026-11-01") } });
  });
});
